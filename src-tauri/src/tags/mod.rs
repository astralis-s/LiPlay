use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use lofty::config::WriteOptions;
use lofty::file::TaggedFile;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, Tag};

/// Open a media file with both extension hints and magic-byte fallback.
///
/// `Probe::open` only uses the extension to guess the format. Many files
/// in the wild have generic / wrong / missing extensions; lofty then errs
/// with "No format could be determined from the provided file" the moment
/// you try to `read()`. Calling `guess_file_type()` explicitly forces a
/// magic-byte sniff so we cover both paths.
fn open_audio(path: &Path) -> anyhow::Result<TaggedFile> {
    let probe = Probe::open(path)
        .with_context(|| format!("opening {}", path.display()))?;
    let probe = probe
        .guess_file_type()
        .with_context(|| format!("identifying {}", path.display()))?;
    Ok(probe
        .read()
        .with_context(|| format!("reading tags of {}", path.display()))?)
}
use serde::{Deserialize, Serialize};

use crate::paths::AppPaths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagPayload {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadTags {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub has_cover: bool,
}

pub fn read(file: &Path) -> Result<ReadTags> {
    let probed = open_audio(file)?;
    let tag = probed.primary_tag().or_else(|| probed.first_tag());
    Ok(ReadTags {
        title: tag.and_then(|t| t.title().map(|s| s.to_string())).unwrap_or_default(),
        artist: tag.and_then(|t| t.artist().map(|s| s.to_string())).unwrap_or_default(),
        album: tag.and_then(|t| t.album().map(|s| s.to_string())).unwrap_or_default(),
        has_cover: tag.map(|t| !t.pictures().is_empty()).unwrap_or(false),
    })
}

/// Permanently rewrite ID3 (or Vorbis comments / RIFF INFO) on the physical
/// file inside Media/. Touches only the requested fields; leaves cover art
/// untouched here  use `set_cover` for art.
pub fn write(file: &Path, payload: &TagPayload) -> Result<()> {
    let mut tagged = open_audio(file)?;

    // Ensure we have a tag of the file's preferred type.
    let primary_type = tagged.primary_tag_type();
    if tagged.primary_tag().is_none() {
        tagged.insert_tag(Tag::new(primary_type));
    }
    let tag = tagged.primary_tag_mut().expect("just inserted");

    if let Some(t) = &payload.title {
        tag.insert_text(ItemKey::TrackTitle, t.clone());
    }
    if let Some(a) = &payload.artist {
        tag.insert_text(ItemKey::TrackArtist, a.clone());
    }
    if let Some(a) = &payload.album {
        tag.insert_text(ItemKey::AlbumTitle, a.clone());
    }

    tagged
        .save_to_path(file, WriteOptions::default())
        .with_context(|| format!("saving tags into {}", file.display()))?;
    Ok(())
}

/// Replace embedded cover art (FrontCover) with the given image bytes.
/// Also overwrites the cached Covers/<id>.<ext> sidecar.
pub fn write_cover(
    file: &Path,
    image_bytes: Vec<u8>,
    mime_hint: Option<String>,
    track_id: &str,
    paths: &AppPaths,
) -> Result<String> {
    let mime = match mime_hint.as_deref() {
        Some("image/png") => MimeType::Png,
        Some("image/jpeg") | Some("image/jpg") => MimeType::Jpeg,
        _ => sniff_mime(&image_bytes),
    };

    let mut tagged = open_audio(file)?;
    let primary_type = tagged.primary_tag_type();
    if tagged.primary_tag().is_none() {
        tagged.insert_tag(Tag::new(primary_type));
    }
    let tag = tagged.primary_tag_mut().expect("just inserted");

    // Drop every existing picture so the new front cover is unambiguous.
    while tag.picture_count() > 0 {
        tag.remove_picture(0);
    }
    tag.push_picture(Picture::new_unchecked(
        PictureType::CoverFront,
        Some(mime.clone()),
        None,
        image_bytes.clone(),
    ));

    tagged.save_to_path(file, WriteOptions::default())?;

    let ext = match mime {
        MimeType::Png => "png",
        MimeType::Jpeg => "jpg",
        _ => "bin",
    };
    let cover_name = format!("{track_id}.{ext}");
    fs::write(paths.covers_dir.join(&cover_name), &image_bytes)?;
    Ok(cover_name)
}

fn sniff_mime(bytes: &[u8]) -> MimeType {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) { MimeType::Png }
    else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) { MimeType::Jpeg }
    else { MimeType::Unknown("application/octet-stream".into()) }
}
