use tauri::State;

use super::CmdResult;
use crate::audio::EqBands;
use crate::library::media_path;
use crate::AppState;

#[tauri::command]
pub async fn play(state: State<'_, AppState>, track_id: String) -> CmdResult<()> {
    let row: (String, i64) =
        sqlx::query_as("SELECT file_name, duration_ms FROM tracks WHERE id = ?")
            .bind(&track_id)
            .fetch_one(&state.db.pool)
            .await?;
    let path = media_path(&state.paths, &row.0)?;
    state.audio.play(path, track_id, row.1.max(0) as u64);
    Ok(())
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> CmdResult<()> { state.audio.pause(); Ok(()) }
#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> CmdResult<()> { state.audio.resume(); Ok(()) }
#[tauri::command]
pub async fn stop(state: State<'_, AppState>) -> CmdResult<()> { state.audio.stop(); Ok(()) }
#[tauri::command]
pub async fn seek(state: State<'_, AppState>, position_ms: u64) -> CmdResult<()> {
    state.audio.seek(position_ms); Ok(())
}
#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> CmdResult<()> {
    state.audio.set_volume(volume); Ok(())
}
#[tauri::command]
pub async fn set_eq(state: State<'_, AppState>, bands: EqBands) -> CmdResult<()> {
    state.audio.set_eq(bands); Ok(())
}
#[tauri::command]
pub async fn set_crossfade(state: State<'_, AppState>, ms: u32) -> CmdResult<()> {
    state.audio.set_crossfade(ms); Ok(())
}
#[tauri::command]
pub async fn set_normalization(state: State<'_, AppState>, enabled: bool) -> CmdResult<()> {
    state.audio.set_normalization(enabled); Ok(())
}
