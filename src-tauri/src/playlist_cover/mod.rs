//! Playlist cover image processing.
//!
//! Two flavours:
//!   * Upload: take raw image bytes (PNG/JPEG), normalise to 512x512 JPEG,
//!     write into Covers/<playlist-id>.jpg. Returns the relative file name.
//!   * Collage: combine the first up-to-4 track covers into a 2x2 grid.
//!     Each cell is the largest centred-crop square of the source. Empty
//!     cells use the elevated palette color.

use std::path::Path;

use anyhow::{Context, Result};
use image::imageops::FilterType;
use image::{DynamicImage, Rgba, RgbaImage};

use crate::paths::AppPaths;

const SIZE: u32 = 512;

pub fn save_uploaded(
    bytes: &[u8],
    playlist_id: &str,
    paths: &AppPaths,
) -> Result<String> {
    let img = image::load_from_memory(bytes)
        .context("decoding uploaded playlist cover")?;
    let normalised = square_crop(&img).resize_exact(SIZE, SIZE, FilterType::Lanczos3);
    let name = format!("playlist-{playlist_id}.jpg");
    let dest = paths.covers_dir.join(&name);
    normalised.to_rgb8().save(&dest)
        .with_context(|| format!("saving {}", dest.display()))?;
    Ok(name)
}

pub fn build_collage(
    track_cover_files: &[String],
    playlist_id: &str,
    paths: &AppPaths,
) -> Result<String> {
    let cell = SIZE / 2;
    let mut canvas: RgbaImage = RgbaImage::from_pixel(SIZE, SIZE, Rgba([26, 26, 30, 255]));
    let positions = [(0, 0), (cell, 0), (0, cell), (cell, cell)];

    for (i, file) in track_cover_files.iter().take(4).enumerate() {
        let p = paths.covers_dir.join(file);
        if !p.exists() { continue; }
        let img = match image::open(&p) { Ok(i) => i, Err(_) => continue };
        let cropped = square_crop(&img).resize_exact(cell, cell, FilterType::Lanczos3);
        image::imageops::overlay(
            &mut canvas,
            &cropped.to_rgba8(),
            positions[i].0 as i64,
            positions[i].1 as i64,
        );
    }

    let name = format!("playlist-{playlist_id}.jpg");
    let dest = paths.covers_dir.join(&name);
    DynamicImage::ImageRgba8(canvas)
        .to_rgb8()
        .save(&dest)
        .with_context(|| format!("saving {}", dest.display()))?;
    Ok(name)
}

fn square_crop(img: &DynamicImage) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    let side = w.min(h);
    let x = (w - side) / 2;
    let y = (h - side) / 2;
    img.crop_imm(x, y, side, side)
}

/// Tiny convenience helper for path resolution.
pub fn cover_disk_path<'a>(paths: &'a AppPaths, name: &str) -> std::path::PathBuf {
    paths.covers_dir.join(name)
}

/// Wipe the cover sidecar on disk if a playlist is deleted or its cover is reset.
pub fn delete_cover(paths: &AppPaths, name: &str) {
    let p: &Path = &paths.covers_dir.join(name);
    let _ = std::fs::remove_file(p);
}
