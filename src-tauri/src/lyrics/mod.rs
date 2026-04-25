use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::paths::AppPaths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsPayload {
    pub synced: bool,
    pub body: String,
    pub source: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LrclibResp {
    #[serde(default)]
    pub plain_lyrics: Option<String>,
    #[serde(default)]
    pub synced_lyrics: Option<String>,
}

/// LRCLIB GET /api/get?artist_name=...&track_name=...&album_name=...&duration=<sec>
pub async fn fetch_from_lrclib(
    http: &reqwest::Client,
    title: &str,
    artist: &str,
    album: &str,
    duration_ms: i64,
) -> Result<LyricsPayload> {
    let mut url = url::Url::parse("https://lrclib.net/api/get")?;
    url.query_pairs_mut()
        .append_pair("track_name", title)
        .append_pair("artist_name", artist)
        .append_pair("album_name", album)
        .append_pair("duration", &(duration_ms / 1000).to_string());

    let resp = http.get(url).send().await?;
    if !resp.status().is_success() {
        return Ok(LyricsPayload {
            synced: false,
            body: String::new(),
            source: "lrclib-miss".into(),
        });
    }
    let parsed: LrclibResp = resp.json().await?;
    if let Some(synced) = parsed.synced_lyrics.filter(|s| !s.is_empty()) {
        Ok(LyricsPayload { synced: true, body: synced, source: "lrclib".into() })
    } else if let Some(plain) = parsed.plain_lyrics.filter(|s| !s.is_empty()) {
        Ok(LyricsPayload { synced: false, body: plain, source: "lrclib".into() })
    } else {
        Ok(LyricsPayload { synced: false, body: String::new(), source: "lrclib-empty".into() })
    }
}

pub fn cache_path(paths: &AppPaths, track_id: &str) -> PathBuf {
    paths.lyrics_dir.join(format!("{track_id}.lrc"))
}

pub fn save(paths: &AppPaths, track_id: &str, body: &str) -> Result<()> {
    fs::write(cache_path(paths, track_id), body)?;
    Ok(())
}

pub fn load(paths: &AppPaths, track_id: &str) -> Result<Option<String>> {
    let p = cache_path(paths, track_id);
    if p.exists() { Ok(Some(fs::read_to_string(p)?)) } else { Ok(None) }
}
