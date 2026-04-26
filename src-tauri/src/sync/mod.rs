//! Local-network sync + Listen Together server.
//!
//! Runs entirely on the Tauri-managed Tokio runtime. None of this code
//! touches the audio thread directly  player state changes are pushed
//! into a `tokio::sync::broadcast` channel by the Tauri event subscription
//! task, and WebSocket clients fan out from there.
//!
//! Endpoints
//! ---------
//!   GET  /info           - device label + DB digest
//!   GET  /db/diff        - { tracks: [{id, sha256}], playlists: [...] }
//!   GET  /file/<id>      - stream a media file (Range supported by ServeFile)
//!   GET  /cover/<name>   - stream a cover sidecar
//!   GET  /ws/listen      - upgrade to WebSocket; receives JSON state pushes
//!
//! Discovery uses mDNS-SD to advertise `_liplay._tcp.local.` with the bound
//! port. Peers can query `_liplay._tcp.local.` to find each other.

use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State as AxState};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeFile;

use crate::paths::AppPaths;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SessionEvent {
    Position { track_id: Option<String>, position_ms: u64, duration_ms: u64, playing: bool },
    TrackChanged { track_id: String },
    DspMode { mode: String },
}

#[derive(Clone)]
pub struct Server {
    pub bind_port: u16,
    pub local_ip: Option<IpAddr>,
    pub session: broadcast::Sender<SessionEvent>,
}

#[derive(Clone)]
struct ServerState {
    paths: Arc<AppPaths>,
    db: crate::db::Db,
    session: broadcast::Sender<SessionEvent>,
}

impl Server {
    pub async fn start(paths: AppPaths, db: crate::db::Db) -> Result<Self> {
        // Bind first so we know the actual port for mDNS.
        let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await?;
        let bind_port = listener.local_addr()?.port();
        let local_ip  = local_ip_address::local_ip().ok();

        let (session_tx, _) = broadcast::channel::<SessionEvent>(64);

        let st = ServerState {
            paths: Arc::new(paths),
            db,
            session: session_tx.clone(),
        };

        let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any);
        let app = Router::new()
            .route("/info",          get(handle_info))
            .route("/db/diff",       get(handle_diff))
            .route("/file/:id",      get(handle_file))
            .route("/cover/:name",   get(handle_cover))
            .route("/ws/listen",     get(handle_ws))
            .with_state(st)
            .layer(cors);

        tauri::async_runtime::spawn(async move {
            if let Err(e) = axum::serve(listener, app.into_make_service()).await {
                tracing::error!("local server crashed: {e:#}");
            }
        });

        // mDNS advertise.
        if let Some(ip) = local_ip {
            spawn_mdns(ip, bind_port);
        }

        Ok(Self { bind_port, local_ip, session: session_tx })
    }
}

fn spawn_mdns(ip: IpAddr, port: u16) {
    tauri::async_runtime::spawn_blocking(move || {
        let daemon = match ServiceDaemon::new() { Ok(d) => d, Err(e) => {
            tracing::error!("mdns daemon: {e:#}"); return;
        }};
        let host = match hostname() { Some(h) => h, None => "liplay".into() };
        let info = ServiceInfo::new(
            "_liplay._tcp.local.",
            &host,
            &format!("{}.local.", host),
            ip.to_string().as_str(),
            port,
            None,
        );
        if let Ok(svc) = info {
            let _ = daemon.register(svc);
        }
        // Daemon stays alive for the process lifetime.
        std::thread::park();
    });
}

fn hostname() -> Option<String> {
    std::env::var("HOSTNAME").ok()
        .or_else(|| std::fs::read_to_string("/etc/hostname").ok().map(|s| s.trim().to_string()))
        .map(|s| if s.is_empty() { "liplay".into() } else { s })
}

#[derive(Serialize)]
struct Info {
    name: String,
    track_count: i64,
}

async fn handle_info(AxState(st): AxState<ServerState>) -> impl IntoResponse {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tracks")
        .fetch_one(&st.db.pool).await.unwrap_or(0);
    axum::Json(Info { name: hostname().unwrap_or_else(|| "liplay".into()), track_count: count })
}

#[derive(Serialize)]
struct Diff {
    tracks:    Vec<DiffTrack>,
    playlists: Vec<DiffPlaylist>,
}
#[derive(Serialize)]
struct DiffTrack { id: String, sha256: String, file_name: String, title: String, artist: String }
#[derive(Serialize)]
struct DiffPlaylist { id: String, name: String }

async fn handle_diff(AxState(st): AxState<ServerState>) -> impl IntoResponse {
    let tracks: Vec<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT id, sha256, file_name, title, artist FROM tracks",
    ).fetch_all(&st.db.pool).await.unwrap_or_default();
    let playlists: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM playlists",
    ).fetch_all(&st.db.pool).await.unwrap_or_default();

    axum::Json(Diff {
        tracks: tracks.into_iter().map(|t| DiffTrack {
            id: t.0, sha256: t.1, file_name: t.2, title: t.3, artist: t.4,
        }).collect(),
        playlists: playlists.into_iter().map(|p| DiffPlaylist { id: p.0, name: p.1 }).collect(),
    })
}

async fn handle_file(
    AxState(st): AxState<ServerState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let row: Option<String> = sqlx::query_scalar("SELECT file_name FROM tracks WHERE id = ?")
        .bind(&id).fetch_optional(&st.db.pool).await.unwrap_or(None);
    match row {
        Some(name) => stream_file(st.paths.media_dir.join(name)).await,
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn handle_cover(
    AxState(st): AxState<ServerState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if name.contains("..") || name.contains('/') {
        return StatusCode::BAD_REQUEST.into_response();
    }
    stream_file(st.paths.covers_dir.join(name)).await
}

async fn stream_file(p: PathBuf) -> axum::response::Response {
    if !p.exists() { return StatusCode::NOT_FOUND.into_response(); }
    use tower::ServiceExt;
    let req = axum::http::Request::builder().body(axum::body::Body::empty()).unwrap();
    match ServeFile::new(p).oneshot(req).await {
        Ok(resp) => resp.into_response(),
        Err(_)   => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ============================ WebSocket =============================

async fn handle_ws(
    ws: WebSocketUpgrade,
    AxState(st): AxState<ServerState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |sock| client_loop(sock, st.session.subscribe()))
}

async fn client_loop(mut socket: WebSocket, mut rx: broadcast::Receiver<SessionEvent>) {
    while let Ok(evt) = rx.recv().await {
        let Ok(json) = serde_json::to_string(&evt) else { continue };
        if socket.send(Message::Text(json)).await.is_err() { break; }
    }
    let _ = socket.send(Message::Close(None)).await;
}

// ====================== Bridge from app events =======================

/// Subscribe to the engine's broadcast events and forward to WebSocket clients.
/// Spawned from setup().
pub fn bridge_events(server: Server, app: tauri::AppHandle) {
    use tauri::Listener;
    let s1 = server.session.clone();
    app.listen("liplay://position", move |ev| {
        if let Ok(state) = serde_json::from_str::<crate::audio::PlaybackState>(ev.payload()) {
            let _ = s1.send(SessionEvent::Position {
                track_id:    state.track_id,
                position_ms: state.position_ms,
                duration_ms: state.duration_ms,
                playing:     state.playing,
            });
        }
    });
    let s2 = server.session.clone();
    app.listen("liplay://track-changed", move |ev| {
        let payload = ev.payload().trim_matches('"').to_string();
        let _ = s2.send(SessionEvent::TrackChanged { track_id: payload });
    });
}
