use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use super::{CmdError, CmdResult};
use crate::AppState;

/// Build the cinematic OSD window on demand. Called from the frontend after
/// the main window has finished its splash animation, so tao's GTK init has
/// already settled  doing this in setup() races with primary-monitor
/// resolution on some Linux compositors and panics.
#[tauri::command]
pub async fn ensure_osd(app: AppHandle) -> CmdResult<()> {
    if app.get_webview_window("osd").is_some() { return Ok(()); }
    let osd = WebviewWindowBuilder::new(&app, "osd", WebviewUrl::App("index.html".into()))
        .title("LiPlay OSD")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .inner_size(380.0, 110.0)
        .visible(false)
        .build()
        .map_err(|e| CmdError::Invalid(format!("osd window: {e}")))?;
    let _ = osd.set_ignore_cursor_events(true);
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct LocalServerInfo {
    pub host: String,
    pub port: u16,
    pub url: String,
    pub ws_url: String,
}

#[tauri::command]
pub async fn local_server_info(state: State<'_, AppState>) -> CmdResult<LocalServerInfo> {
    let guard = state.server.lock();
    let server = guard.as_ref().ok_or_else(||
        CmdError::Invalid("local server not ready yet".into()))?;
    let port = server.bind_port;
    let host = server.local_ip
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".into());
    Ok(LocalServerInfo {
        url:    format!("http://{}:{}", host, port),
        ws_url: format!("ws://{}:{}/ws/listen", host, port),
        host,
        port,
    })
}

/// Render a Listen Together QR as an SVG string. Doing it in Rust avoids
/// pulling a JS QR library; the frontend can drop the SVG into an <img src=
/// "data:image/svg+xml;..."> or render it raw.
#[tauri::command]
pub async fn listen_together_qr(state: State<'_, AppState>) -> CmdResult<String> {
    let info = local_server_info(state).await?;
    let payload = format!(r#"{{"v":1,"url":"{}","ws":"{}"}}"#, info.url, info.ws_url);
    let code = qrcode::QrCode::new(payload.as_bytes())
        .map_err(|e| super::CmdError::Invalid(format!("qr: {e}")))?;
    let svg = code.render::<qrcode::render::svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(false)
        .dark_color(qrcode::render::svg::Color("#0a0a0c"))
        .light_color(qrcode::render::svg::Color("#ffffff"))
        .build();
    Ok(svg)
}
