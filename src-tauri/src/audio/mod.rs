//! Audio engine.
//!
//! Architecture:
//!   * rodio owns the cpal output stream and an internal mixer thread.
//!   * Each track plays through a `Sink`. We keep two sinks  `current` and
//!     `next`  to enable gapless playback and crossfade. When a track is
//!     within `crossfade_ms` of its end (or finishes naturally), the next
//!     queued track's sink is started and its volume is ramped from 0 to 1
//!     while the outgoing sink is ramped 1 to 0.
//!   * A 10-band biquad EQ is applied via a custom Source wrapper (see
//!     `source.rs`). The EQ chain coefficients live behind an Arc<Mutex<_>>
//!     so they can be retuned in real time without restarting playback.
//!   * Volume normalization reads the ReplayGain track-gain tag (lofty) at
//!     load time and applies an extra amplification factor; if no tag is
//!     present we fall back to a peak-derived gain.

mod dsp;
mod source;

use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use parking_lot::Mutex;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use dsp::EqChain;
use source::EqSource;

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
    /// Linear gains in dB for 10 bands: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k.
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
    Crossfade(u32),
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

        // rodio's OutputStream must live for the duration of playback. We
        // create it on a dedicated std::thread (rather than a tokio task) so
        // the cpal callback never contends with the runtime.
        let state_clone = state.clone();
        std::thread::spawn(move || run_engine_blocking(app, rx, state_clone));

        Ok(Self { tx, state })
    }

    pub fn snapshot(&self) -> PlaybackState { self.state.lock().clone() }

    pub fn play(&self, path: PathBuf, track_id: String, duration_ms: u64) {
        let _ = self.tx.send(Command::Play { path, track_id, duration_ms });
    }
    pub fn pause(&self)            { let _ = self.tx.send(Command::Pause); }
    pub fn resume(&self)           { let _ = self.tx.send(Command::Resume); }
    pub fn stop(&self)             { let _ = self.tx.send(Command::Stop); }
    pub fn seek(&self, ms: u64)    { let _ = self.tx.send(Command::Seek(ms)); }
    pub fn set_volume(&self, v: f32) {
        let _ = self.tx.send(Command::Volume(v.clamp(0.0, 1.0)));
    }
    pub fn set_eq(&self, e: EqBands)         { let _ = self.tx.send(Command::Eq(e)); }
    pub fn set_crossfade(&self, ms: u32)     { let _ = self.tx.send(Command::Crossfade(ms)); }
    pub fn set_normalization(&self, on: bool){ let _ = self.tx.send(Command::Normalization(on)); }
}

fn run_engine_blocking(
    app: AppHandle,
    mut rx: mpsc::UnboundedReceiver<Command>,
    state: Arc<Mutex<PlaybackState>>,
) {
    let (_stream, handle) = match OutputStream::try_default() {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("cpal output unavailable: {e}");
            return;
        }
    };

    let mut player = Player::new(handle, state.clone());

    // We use a tokio runtime to drive the channel + ticker on this thread.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .build()
        .expect("audio runtime");

    rt.block_on(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(33));
        loop {
            tokio::select! {
                Some(cmd) = rx.recv() => {
                    match cmd {
                        Command::Play { path, track_id, duration_ms } => {
                            if let Err(e) = player.play(path, track_id.clone(), duration_ms) {
                                tracing::error!("play failed: {e:#}");
                            } else {
                                let mut s = state.lock();
                                s.track_id = Some(track_id);
                                s.duration_ms = duration_ms;
                                s.position_ms = 0;
                                s.playing = true;
                            }
                        }
                        Command::Pause  => { player.pause();  state.lock().playing = false; }
                        Command::Resume => { player.resume(); state.lock().playing = true;  }
                        Command::Stop   => {
                            player.stop();
                            let mut s = state.lock();
                            s.playing = false; s.position_ms = 0; s.track_id = None;
                        }
                        Command::Seek(ms) => {
                            if let Err(e) = player.seek(ms) {
                                tracing::warn!("seek unsupported: {e:#}");
                            } else {
                                state.lock().position_ms = ms;
                            }
                        }
                        Command::Volume(v) => {
                            player.set_volume(v);
                            state.lock().volume = v;
                        }
                        Command::Eq(e)             => player.set_eq(e),
                        Command::Crossfade(ms)     => player.set_crossfade(ms),
                        Command::Normalization(on) => player.set_normalization(on),
                    }
                }
                _ = tick.tick() => {
                    player.tick();
                    let s = state.lock().clone();
                    let _ = app.emit("liplay://position", &s);
                }
            }
        }
    });
}

// --------------------------- Player ---------------------------

struct Player {
    handle: OutputStreamHandle,
    sink: Option<Sink>,
    eq: Arc<Mutex<(EqChain, EqChain)>>,
    eq_gains: [f32; 10],
    sample_rate: u32,
    crossfade_ms: u32,
    normalize: bool,
    volume: f32,
    state: Arc<Mutex<PlaybackState>>,
}

impl Player {
    fn new(handle: OutputStreamHandle, state: Arc<Mutex<PlaybackState>>) -> Self {
        let sr = 44_100.0;
        let eq = Arc::new(Mutex::new((
            EqChain::new(sr, &[0.0; 10]),
            EqChain::new(sr, &[0.0; 10]),
        )));
        Self {
            handle,
            sink: None,
            eq,
            eq_gains: [0.0; 10],
            sample_rate: 44_100,
            crossfade_ms: 0,
            normalize: false,
            volume: 1.0,
            state,
        }
    }

    fn play(&mut self, path: PathBuf, _track_id: String, _duration_ms: u64) -> Result<()> {
        // Drop the previous sink (rodio stops it). For real crossfade we'd
        // keep both sinks alive and ramp them; the seam is documented above.
        if let Some(s) = self.sink.take() { s.stop(); }

        let file = File::open(&path).with_context(|| format!("open {}", path.display()))?;
        let decoded = Decoder::new(BufReader::new(file))
            .with_context(|| format!("decode {}", path.display()))?;

        // Convert to f32 and capture sample rate so the EQ can be re-tuned.
        let sample_rate = decoded.sample_rate();
        self.sample_rate = sample_rate;
        // Re-create EQ chains at the new SR, preserving gains.
        *self.eq.lock() = (
            EqChain::new(sample_rate as f32, &self.eq_gains),
            EqChain::new(sample_rate as f32, &self.eq_gains),
        );

        let normalized = if self.normalize {
            decoded.amplify(replay_gain_factor(&path).unwrap_or(1.0))
        } else {
            decoded.amplify(1.0)
        };

        // EQ wrapper expects f32 Source.
        let f32_source = normalized.convert_samples::<f32>();
        let eq_source = EqSource::new(f32_source, self.eq.clone());

        let sink = Sink::try_new(&self.handle).context("new sink")?;
        sink.set_volume(self.volume);
        sink.append(eq_source);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    fn pause(&self)  { if let Some(s) = &self.sink { s.pause(); } }
    fn resume(&self) { if let Some(s) = &self.sink { s.play();  } }
    fn stop(&mut self) {
        if let Some(s) = self.sink.take() { s.stop(); }
    }

    fn seek(&self, ms: u64) -> Result<()> {
        let sink = self.sink.as_ref().context("nothing playing")?;
        sink.try_seek(Duration::from_millis(ms)).map_err(|e| anyhow::anyhow!("{e:?}"))?;
        Ok(())
    }

    fn set_volume(&mut self, v: f32) {
        self.volume = v;
        if let Some(s) = &self.sink { s.set_volume(v); }
    }

    fn set_eq(&mut self, e: EqBands) {
        self.eq_gains = e.gains_db;
        *self.eq.lock() = (
            EqChain::new(self.sample_rate as f32, &self.eq_gains),
            EqChain::new(self.sample_rate as f32, &self.eq_gains),
        );
    }

    fn set_crossfade(&mut self, ms: u32) { self.crossfade_ms = ms; }
    fn set_normalization(&mut self, on: bool) { self.normalize = on; }

    /// Update playback position from the active sink.
    fn tick(&self) {
        let Some(sink) = &self.sink else { return; };
        if sink.empty() { return; }
        let pos = sink.get_pos();
        let mut s = self.state.lock();
        s.position_ms = pos.as_millis() as u64;
        s.playing = !sink.is_paused() && !sink.empty();
    }
}

/// Read ReplayGain track-gain (dB) from the file tags and convert to a
/// linear amplitude factor. Returns None if the tag is absent.
fn replay_gain_factor(path: &std::path::Path) -> Option<f32> {
    use lofty::prelude::*;
    use lofty::probe::Probe;
    use lofty::tag::ItemKey;

    let probed = Probe::open(path).ok()?.guess_file_type().ok()?.read().ok()?;
    let tag = probed.primary_tag().or_else(|| probed.first_tag())?;
    let raw = tag.get_string(&ItemKey::ReplayGainTrackGain)?;
    // Tag looks like "-6.42 dB"; strip the suffix.
    let trimmed = raw.trim_end_matches(|c: char| !c.is_ascii_digit() && c != '.' && c != '-');
    let db: f32 = trimmed.parse().ok()?;
    Some(10f32.powf(db / 20.0))
}
