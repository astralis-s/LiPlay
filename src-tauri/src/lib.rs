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
    pub server: sync::Server,
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
                let server = sync::Server::start(paths.clone(), db.clone()).await?;
                sync::bridge_events(server.clone(), handle.clone());
                Ok::<_, anyhow::Error>(AppState { db, paths, audio, http, server })
            })?;

            app.manage(state);

            // OSD window is no longer created in setup() - it was the
            // trigger for a tao 0.34.8 panic on some Linux compositors.
            // The frontend now calls `ensure_osd` once the main window
            // has rendered, by which point GTK + tao are fully initialized.

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
            commands::sync::ensure_osd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LiPlay");
}
