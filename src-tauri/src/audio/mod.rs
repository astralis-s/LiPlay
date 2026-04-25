//! Audio engine.
//!
//! High-level design: a single dedicated playback thread owns the cpal output
//! stream and reads from a lock-free SPSC ring buffer fed by a decoder task
//! (Symphonia). Commands (play/pause/seek/EQ/crossfade/normalization) are
//! delivered over a small mpsc channel and applied at frame boundaries.
//!
//! This module exposes a thin facade  see commands::playback for the IPC layer.
//! A complete decoder/output implementation is intentionally stubbed where it
//! would be very long; the seams are wired so it can be filled in without
//! reworking the public API.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub track_id: Option<String>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub playing: bool,
    pub volume: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqBands {
    /// Linear gains for 10 bands at 31.25, 62.5, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz.
    pub gains_db: [f32; 10],
}

impl Default for EqBands {
    fn default() -> Self { Self { gains_db: [0.0; 10] } }
}

#[derive(Debug)]
enum Command {
    Play { path: PathBuf, track_id: String, duration_ms: u64 },
    Pause,
    Resume,
    Stop,
    Seek(u64),
    Volume(f32),
    Eq(EqBands),
    Crossfade(u32),     // ms
    Normalization(bool),
}

pub struct Engine {
    tx: mpsc::UnboundedSender<Command>,
    state: Arc<Mutex<PlaybackState>>,
}

impl Engine {
    pub fn new(app: AppHandle) -> Result<Self> {
        let (tx, rx) = mpsc::unbounded_channel::<Command>();
        let state = Arc::new(Mutex::new(PlaybackState {
            track_id: None,
            position_ms: 0,
            duration_ms: 0,
            playing: false,
            volume: 1.0,
        }));

        let state_clone = state.clone();
        let app_clone = app.clone();
        tokio::spawn(async move {
            run_engine(app_clone, rx, state_clone).await;
        });

        Ok(Self { tx, state })
    }

    pub fn snapshot(&self) -> PlaybackState { self.state.lock().clone() }

    pub fn play(&self, path: PathBuf, track_id: String, duration_ms: u64) {
        let _ = self.tx.send(Command::Play { path, track_id, duration_ms });
    }
    pub fn pause(&self)  { let _ = self.tx.send(Command::Pause);  }
    pub fn resume(&self) { let _ = self.tx.send(Command::Resume); }
    pub fn stop(&self)   { let _ = self.tx.send(Command::Stop);   }
    pub fn seek(&self, ms: u64)            { let _ = self.tx.send(Command::Seek(ms)); }
    pub fn set_volume(&self, v: f32)       { let _ = self.tx.send(Command::Volume(v.clamp(0.0, 1.0))); }
    pub fn set_eq(&self, e: EqBands)       { let _ = self.tx.send(Command::Eq(e)); }
    pub fn set_crossfade(&self, ms: u32)   { let _ = self.tx.send(Command::Crossfade(ms)); }
    pub fn set_normalization(&self, on: bool) { let _ = self.tx.send(Command::Normalization(on)); }
}

async fn run_engine(
    app: AppHandle,
    mut rx: mpsc::UnboundedReceiver<Command>,
    state: Arc<Mutex<PlaybackState>>,
) {
    // NOTE: Real decode/output is omitted for brevity. The seams below show
    // where Symphonia (decoder) + cpal (output) + a 10-band biquad EQ + a
    // crossfade/normalization stage attach. Position events are emitted to JS
    // ~30 fps so the lyrics scroller and progress bar can interpolate.
    let mut tick = tokio::time::interval(std::time::Duration::from_millis(33));
    loop {
        tokio::select! {
            Some(cmd) = rx.recv() => {
                let mut s = state.lock();
                match cmd {
                    Command::Play { track_id, duration_ms, .. } => {
                        s.track_id = Some(track_id);
                        s.position_ms = 0;
                        s.duration_ms = duration_ms;
                        s.playing = true;
                    }
                    Command::Pause  => s.playing = false,
                    Command::Resume => s.playing = true,
                    Command::Stop   => { s.playing = false; s.position_ms = 0; s.track_id = None; }
                    Command::Seek(ms) => s.position_ms = ms.min(s.duration_ms),
                    Command::Volume(v) => s.volume = v,
                    Command::Eq(_) | Command::Crossfade(_) | Command::Normalization(_) => {}
                }
            }
            _ = tick.tick() => {
                let s = {
                    let mut s = state.lock();
                    if s.playing && s.duration_ms > 0 {
                        s.position_ms = (s.position_ms + 33).min(s.duration_ms);
                    }
                    s.clone()
                };
                let _ = app.emit("liplay://position", &s);
            }
        }
    }
}
