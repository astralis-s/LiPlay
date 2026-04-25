use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::{CmdError, CmdResult};
use crate::library::{import_file, ImportedTrack};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub file_name: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub cover_path: Option<String>,
    pub play_count: i64,
    pub added_at: String,
}

#[tauri::command]
pub async fn import_tracks(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> CmdResult<Vec<ImportedTrack>> {
    let mut out = Vec::with_capacity(paths.len());
    for p in paths {
        let imported = import_file(&PathBuf::from(&p), &state.paths)?;
        sqlx::query(
            "INSERT INTO tracks
                (id, file_name, title, artist, album, duration_ms, cover_path, sha256)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&imported.id)
        .bind(&imported.file_name)
        .bind(&imported.title)
        .bind(&imported.artist)
        .bind(&imported.album)
        .bind(imported.duration_ms)
        .bind(&imported.cover_path)
        .bind(&imported.sha256)
        .execute(&state.db.pool)
        .await?;
        out.push(imported);
    }
    Ok(out)
}

#[tauri::command]
pub async fn list_tracks(state: State<'_, AppState>) -> CmdResult<Vec<Track>> {
    let rows: Vec<(String, String, String, String, String, i64, Option<String>, i64, String)> =
        sqlx::query_as(
            "SELECT id, file_name, title, artist, album, duration_ms, cover_path, play_count, added_at
               FROM tracks ORDER BY added_at DESC",
        )
        .fetch_all(&state.db.pool)
        .await?;

    Ok(rows.into_iter().map(|r| Track {
        id: r.0, file_name: r.1, title: r.2, artist: r.3, album: r.4,
        duration_ms: r.5, cover_path: r.6, play_count: r.7, added_at: r.8,
    }).collect())
}

#[tauri::command]
pub async fn delete_track(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let row: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT file_name, cover_path FROM tracks WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.db.pool)
            .await?;

    if let Some((file_name, cover)) = row {
        let _ = std::fs::remove_file(state.paths.media_dir.join(&file_name));
        if let Some(c) = cover {
            let _ = std::fs::remove_file(state.paths.covers_dir.join(&c));
        }
        let _ = std::fs::remove_file(state.paths.lyrics_dir.join(format!("{id}.lrc")));
    }
    sqlx::query("DELETE FROM tracks WHERE id = ?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[tauri::command]
pub async fn create_playlist(state: State<'_, AppState>, name: String) -> CmdResult<Playlist> {
    if name.trim().is_empty() {
        return Err(CmdError::Invalid("playlist name is empty".into()));
    }
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO playlists (id, name) VALUES (?, ?)")
        .bind(&id).bind(&name)
        .execute(&state.db.pool).await?;
    let row: (String,) = sqlx::query_as("SELECT created_at FROM playlists WHERE id = ?")
        .bind(&id).fetch_one(&state.db.pool).await?;
    Ok(Playlist { id, name, created_at: row.0 })
}

#[tauri::command]
pub async fn list_playlists(state: State<'_, AppState>) -> CmdResult<Vec<Playlist>> {
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT id, name, created_at FROM playlists ORDER BY created_at DESC")
            .fetch_all(&state.db.pool).await?;
    Ok(rows.into_iter().map(|(id, name, created_at)| Playlist { id, name, created_at }).collect())
}

#[tauri::command]
pub async fn add_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> CmdResult<()> {
    let pos: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?",
    )
    .bind(&playlist_id).fetch_one(&state.db.pool).await?;

    sqlx::query(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
    )
    .bind(&playlist_id).bind(&track_id).bind(pos)
    .execute(&state.db.pool).await?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct RecapEntry {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub plays: i64,
}

/// "Monthly recap": the top 25 tracks by play count for the given YYYY-MM.
#[tauri::command]
pub async fn monthly_recap(
    state: State<'_, AppState>,
    year_month: String, // "2026-04"
) -> CmdResult<Vec<RecapEntry>> {
    let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
        r#"
        SELECT t.id, t.title, t.artist, COUNT(p.id) AS plays
          FROM plays p
          JOIN tracks t ON t.id = p.track_id
         WHERE strftime('%Y-%m', p.played_at) = ?
         GROUP BY t.id
         ORDER BY plays DESC
         LIMIT 25
        "#,
    )
    .bind(&year_month)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(rows.into_iter().map(|r| RecapEntry {
        track_id: r.0, title: r.1, artist: r.2, plays: r.3,
    }).collect())
}

#[tauri::command]
pub async fn record_play(state: State<'_, AppState>, track_id: String) -> CmdResult<()> {
    let mut tx = state.db.pool.begin().await?;
    sqlx::query("INSERT INTO plays (track_id) VALUES (?)").bind(&track_id).execute(&mut *tx).await?;
    sqlx::query("UPDATE tracks SET play_count = play_count + 1 WHERE id = ?")
        .bind(&track_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}
