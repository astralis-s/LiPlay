use std::path::PathBuf;

use anyhow::{Context, Result};

/// All on-disk locations LiPlay owns. Strictly XDG-compliant on Linux:
///
///     ~/.local/share/LiPlay/
///         Media/      <- copied audio files (the only place playback ever reads from)
///         Covers/     <- extracted/normalized cover art
///         Lyrics/     <- cached .lrc files (one per track id)
///         liplay.db   <- SQLite
#[derive(Clone, Debug)]
pub struct AppPaths {
    pub root: PathBuf,
    pub media_dir: PathBuf,
    pub covers_dir: PathBuf,
    pub lyrics_dir: PathBuf,
    pub db_file: PathBuf,
}

impl AppPaths {
    pub fn resolve() -> Result<Self> {
        let data = dirs::data_local_dir()
            .context("could not locate XDG data dir (~/.local/share)")?;
        let root = data.join("LiPlay");
        Ok(Self {
            media_dir: root.join("Media"),
            covers_dir: root.join("Covers"),
            lyrics_dir: root.join("Lyrics"),
            db_file: root.join("liplay.db"),
            root,
        })
    }

    pub fn ensure_exist(&self) -> Result<()> {
        for d in [&self.root, &self.media_dir, &self.covers_dir, &self.lyrics_dir] {
            std::fs::create_dir_all(d)
                .with_context(|| format!("creating {}", d.display()))?;
        }
        Ok(())
    }
}
