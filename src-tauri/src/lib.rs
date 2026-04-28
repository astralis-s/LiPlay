use std::sync::Arc;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

mod audio;
mod commands;
mod db;
mod library;
mod lyrics;
mod paths;
mod playlist_cover;
mod sync;
mod tags;

pub struct AppState {
    pub db: db::Db,
    pub paths: paths::AppPaths,
    pub audio: Arc<audio::Engine>,
    pub http: reqwest::Client,
    pub server: parking_lot::Mutex<Option<sync::Server>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let paths = paths::AppPaths::resolve()?;
            paths.ensure_exist()?;

            let state = tauri::async_runtime::block_on(async move {
                let db = db::Db::connect(&paths.db_file).await?;
                db.migrate().await?;
                let audio = Arc::new(audio::Engine::new(handle.clone())?);
                let http = reqwest::Client::builder()
                    .user_agent("LiPlay/0.1 (+https://liplay.app)")
                    .build()?;
                Ok::<_, anyhow::Error>(AppState {
                    db, paths, audio, http,
                    server: parking_lot::Mutex::new(None),
                })
            })?;

            app.manage(state);

            // Local sync + Listen Together server is started lazily after the
            // main window has rendered. mdns-sd and axum bring in extra GTK /
            // network init paths; deferring them keeps setup() small enough
            // that any compositor quirks don't compound at startup.
            let app_handle_for_server = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(2_000)).await;
                let st = app_handle_for_server.state::<AppState>();
                let server = match sync::Server::start(st.paths.clone(), st.db.clone()).await {
                    Ok(s)  => s,
                    Err(e) => { tracing::warn!("local server unavailable: {e:#}"); return; }
                };
                sync::bridge_events(server.clone(), app_handle_for_server.clone());
                *st.server.lock() = Some(server);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::library::get_paths,
            commands::library::import_tracks,
            commands::library::list_tracks,
            commands::library::delete_track,
            commands::library::create_playlist,
            commands::library::list_playlists,
            commands::library::add_to_playlist,
            commands::library::remove_from_playlist,
            commands::library::delete_playlist,
            commands::library::playlist_tracks,
            commands::library::set_playlist_cover_upload,
            commands::library::set_playlist_cover_collage,
            commands::library::monthly_recap,
            commands::library::record_play,
            commands::tags::read_tags,
            commands::tags::write_tags,
            commands::tags::set_cover,
            commands::lyrics::fetch_lyrics,
            commands::lyrics::save_lrc,
            commands::lyrics::load_lrc,
            commands::playback::play,
            commands::playback::pause,
            commands::playback::resume,
            commands::playback::stop,
            commands::playback::seek,
            commands::playback::set_volume,
            commands::playback::set_eq,
            commands::playback::set_crossfade,
            commands::playback::set_normalization,
            commands::playback::set_dsp_mode,
            commands::sync::local_server_info,
            commands::sync::listen_together_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiPlay");
}
