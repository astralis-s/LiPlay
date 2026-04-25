use tauri::State;

use super::CmdResult;
use crate::library::media_path;
use crate::tags::{self, ReadTags, TagPayload};
use crate::AppState;

#[tauri::command]
pub async fn read_tags(state: State<'_, AppState>, track_id: String) -> CmdResult<ReadTags> {
    let file_name: String =
        sqlx::query_scalar("SELECT file_name FROM tracks WHERE id = ?")
            .bind(&track_id)
            .fetch_one(&state.db.pool)
            .await?;
    let path = media_path(&state.paths, &file_name)?;
    Ok(tags::read(&path)?)
}

#[tauri::command]
pub async fn write_tags(
    state: State<'_, AppState>,
    track_id: String,
    payload: TagPayload,
) -> CmdResult<()> {
    let file_name: String =
        sqlx::query_scalar("SELECT file_name FROM tracks WHERE id = ?")
            .bind(&track_id)
            .fetch_one(&state.db.pool)
            .await?;
    let path = media_path(&state.paths, &file_name)?;

    // 1) Persist into the physical file.
    tags::write(&path, &payload)?;

    // 2) Mirror into the DB so the UI list reflects the change immediately.
    sqlx::query(
        r#"
        UPDATE tracks
           SET title  = COALESCE(?, title),
               artist = COALESCE(?, artist),
               album  = COALESCE(?, album)
         WHERE id = ?
        "#,
    )
    .bind(&payload.title)
    .bind(&payload.artist)
    .bind(&payload.album)
    .bind(&track_id)
    .execute(&state.db.pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn set_cover(
    state: State<'_, AppState>,
    track_id: String,
    image_bytes: Vec<u8>,
    mime: Option<String>,
) -> CmdResult<String> {
    let file_name: String =
        sqlx::query_scalar("SELECT file_name FROM tracks WHERE id = ?")
            .bind(&track_id)
            .fetch_one(&state.db.pool)
            .await?;
    let path = media_path(&state.paths, &file_name)?;

    let cover_name = tags::write_cover(&path, image_bytes, mime, &track_id, &state.paths)?;
    sqlx::query("UPDATE tracks SET cover_path = ? WHERE id = ?")
        .bind(&cover_name)
        .bind(&track_id)
        .execute(&state.db.pool)
        .await?;
    Ok(cover_name)
}
