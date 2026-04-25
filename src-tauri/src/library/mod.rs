use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use lofty::file::AudioFile;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::paths::AppPaths;

const ALLOWED_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "ogg", "opus"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedTrack {
    pub id: String,
    pub file_name: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub cover_path: Option<String>,
    pub sha256: String,
}

/// Copy `src` into the internal Media dir under a content-addressed name.
/// Returns metadata extracted from the file. The original file is never touched
/// or referenced afterwards.
pub fn import_file(src: &Path, paths: &AppPaths) -> Result<ImportedTrack> {
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| anyhow!("file has no extension: {}", src.display()))?;
    if !ALLOWED_EXTS.contains(&ext.as_str()) {
        return Err(anyhow!("unsupported audio format: {}", ext));
    }

    // Hash + copy in one stream so we never load the whole file in memory.
    let id = Uuid::new_v4().to_string();
    let dest_name = format!("{id}.{ext}");
    let dest_path = paths.media_dir.join(&dest_name);

    let sha = stream_copy_with_hash(src, &dest_path)
        .with_context(|| format!("copying {} -> {}", src.display(), dest_path.display()))?;

    // Probe metadata from the *destination* (the only path we'll ever read again).
    let probe = Probe::open(&dest_path)?.read()?;
    let props = probe.properties();
    let duration_ms = props.duration().as_millis() as i64;

    let mut title = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();
    let mut artist = String::new();
    let mut album = String::new();
    let mut cover_path: Option<String> = None;

    if let Some(tag) = probe.primary_tag().or_else(|| probe.first_tag()) {
        if let Some(t) = tag.title() { title = t.to_string(); }
        if let Some(a) = tag.artist() { artist = a.to_string(); }
        if let Some(a) = tag.album() { album = a.to_string(); }

        if let Some(pic) = tag.pictures().first() {
            let cover_ext = match pic.mime_type() {
                Some(lofty::picture::MimeType::Png) => "png",
                Some(lofty::picture::MimeType::Jpeg) => "jpg",
                _ => "bin",
            };
            let cover_name = format!("{id}.{cover_ext}");
            let cover_full = paths.covers_dir.join(&cover_name);
            fs::write(&cover_full, pic.data())
                .with_context(|| format!("writing cover {}", cover_full.display()))?;
            cover_path = Some(cover_name);
        }
    }

    Ok(ImportedTrack {
        id,
        file_name: dest_name,
        title,
        artist,
        album,
        duration_ms,
        cover_path,
        sha256: sha,
    })
}

fn stream_copy_with_hash(src: &Path, dest: &Path) -> Result<String> {
    let mut input = fs::File::open(src)?;
    let mut output = fs::File::create(dest)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = input.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        output.write_all(&buf[..n])?;
    }
    output.flush()?;
    Ok(hex::encode(hasher.finalize()))
}

/// Resolve a stored relative file_name to an absolute path inside Media/.
/// Refuses to escape Media/ via traversal.
pub fn media_path(paths: &AppPaths, file_name: &str) -> Result<PathBuf> {
    let candidate = paths.media_dir.join(file_name);
    let canon = candidate
        .canonicalize()
        .with_context(|| format!("canonicalize {}", candidate.display()))?;
    let root = paths.media_dir.canonicalize()?;
    if !canon.starts_with(&root) {
        return Err(anyhow!("path escapes media dir"));
    }
    Ok(canon)
}
