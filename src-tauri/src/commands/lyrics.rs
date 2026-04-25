use tauri::State;

use super::CmdResult;
use crate::lyrics::{self, LyricsPayload};
use crate::AppState;

#[tauri::command]
pub async fn fetch_lyrics(
    state: State<'_, AppState>,
    track_id: String,
) -> CmdResult<LyricsPayload> {
    // 1) Try the local cache first.
    if let Some(body) = lyrics::load(&state.paths, &track_id)? {
        let synced = body.contains('[') && body.contains(']');
        return Ok(LyricsPayload { synced, body, source: "cache".into() });
    }

    // 2) Look up track metadata for the LRCLIB query.
    let row: (String, String, String, i64) = sqlx::query_as(
        "SELECT title, artist, album, duration_ms FROM tracks WHERE id = ?",
    )
    .bind(&track_id)
    .fetch_one(&state.db.pool)
    .await?;

    let payload = lyrics::fetch_from_lrclib(&state.http, &row.0, &row.1, &row.2, row.3).await?;

    // 3) Cache to disk + DB.
    if !payload.body.is_empty() {
        lyrics::save(&state.paths, &track_id, &payload.body)?;
        sqlx::query(
            "INSERT INTO lyrics (track_id, synced, body, source)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(track_id) DO UPDATE SET
                synced = excluded.synced,
                body   = excluded.body,
                source = excluded.source,
                fetched_at = datetime('now')",
        )
        .bind(&track_id)
        .bind(payload.synced as i64)
        .bind(&payload.body)
        .bind(&payload.source)
        .execute(&state.db.pool)
        .await?;
    }
    Ok(payload)
}

#[tauri::command]
pub async fn save_lrc(
    state: State<'_, AppState>,
    track_id: String,
    body: String,
    synced: bool,
    source: Option<String>,
) -> CmdResult<()> {
    lyrics::save(&state.paths, &track_id, &body)?;
    sqlx::query(
        "INSERT INTO lyrics (track_id, synced, body, source)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(track_id) DO UPDATE SET
            synced = excluded.synced,
            body   = excluded.body,
            source = excluded.source,
            fetched_at = datetime('now')",
    )
    .bind(&track_id)
    .bind(synced as i64)
    .bind(&body)
    .bind(&source.unwrap_or_else(|| "manual".into()))
    .execute(&state.db.pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn load_lrc(
    state: State<'_, AppState>,
    track_id: String,
) -> CmdResult<Option<LyricsPayload>> {
    let row: Option<(i64, String, String)> =
        sqlx::query_as("SELECT synced, body, source FROM lyrics WHERE track_id = ?")
            .bind(&track_id)
            .fetch_optional(&state.db.pool)
            .await?;
    Ok(row.map(|(s, b, src)| LyricsPayload { synced: s != 0, body: b, source: src }))
}
