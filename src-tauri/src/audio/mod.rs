//! Audio engine.
//!
//! Pipeline (when nightcore/slowed are off):
//!     Decoder -> Amplify(replay-gain) -> convert<f32>
//!             -> Speed(factor)      // 1.0 by default
//!             -> Reverb (optional)  // dry-only when bypass
//!             -> Eq                 // 10-band biquad
//!             -> FFT tap            // mirrors samples to a SPSC ring
//!             -> Sink (cpal output)
//!
//! Threading
//! --------
//! All cpal-side work happens on rodio's internal callback thread. Our
//! engine thread (a dedicated std::thread, NOT a Tokio worker) owns the
//! `Sink` and the shared `Arc<Mutex<...>>` parameters; it pumps commands
//! from the IPC mpsc and drives a 33 ms timer that emits position events.
//!
//! The FFT pump is a separate Tokio task spawned from setup() that
//! consumes the ring buffer at ~30 Hz, runs a 1024-point real FFT, and
//! emits magnitude bins to the screensaver.

mod dsp;
mod reverb;
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
use reverb::Freeverb;
use source::{EqSource, FftTapSource, ReverbSource};

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
    pub gains_db: [f32; 10],
}

impl Default for EqBands {
    fn default() -> Self { Self { gains_db: [0.0; 10] } }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DspMode {
    Off,
    SlowedReverb,
    Nightcore,
}

impl Default for DspMode {
    fn default() -> Self { Self::Off }
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
    DspMode(DspMode),
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
        let fft_consumer = Arc::new(Mutex::new(None));
        let sample_rate = Arc::new(std::sync::atomic::AtomicU32::new(44_100));

        let s_clone  = state.clone();
        let f_clone  = fft_consumer.clone();
        let sr_clone = sample_rate.clone();
        let app_c = app.clone();
        std::thread::spawn(move || run_engine_blocking(app_c, rx, s_clone, f_clone, sr_clone));

        // FFT pump on the Tokio runtime  emits 32 magnitude bins at 30 Hz.
        spawn_fft_pump(app, fft_consumer, sample_rate);

        Ok(Self { tx, state })
    }

    pub fn snapshot(&self) -> PlaybackState { self.state.lock().clone() }

    pub fn play(&self, path: PathBuf, track_id: String, duration_ms: u64) {
        let _ = self.tx.send(Command::Play { path, track_id, duration_ms });
    }
    pub fn pause(&self)  { let _ = self.tx.send(Command::Pause); }
    pub fn resume(&self) { let _ = self.tx.send(Command::Resume); }
    pub fn stop(&self)   { let _ = self.tx.send(Command::Stop); }
    pub fn seek(&self, ms: u64)        { let _ = self.tx.send(Command::Seek(ms)); }
    pub fn set_volume(&self, v: f32)   { let _ = self.tx.send(Command::Volume(v.clamp(0.0, 1.0))); }
    pub fn set_eq(&self, e: EqBands)   { let _ = self.tx.send(Command::Eq(e)); }
    pub fn set_crossfade(&self, ms: u32) { let _ = self.tx.send(Command::Crossfade(ms)); }
    pub fn set_normalization(&self, on: bool) { let _ = self.tx.send(Command::Normalization(on)); }
    pub fn set_dsp_mode(&self, m: DspMode) { let _ = self.tx.send(Command::DspMode(m)); }
}

fn run_engine_blocking(
    app: AppHandle,
    mut rx: mpsc::UnboundedReceiver<Command>,
    state: Arc<Mutex<PlaybackState>>,
    fft_consumer: Arc<Mutex<Option<ringbuf::HeapCons<f32>>>>,
    sample_rate: Arc<std::sync::atomic::AtomicU32>,
) {
    let (_stream, handle) = match OutputStream::try_default() {
        Ok(p) => p,
        Err(e) => { tracing::error!("cpal output unavailable: {e}"); return; }
    };

    let mut player = Player::new(handle, state.clone(), fft_consumer, sample_rate);

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
                                s.track_id = Some(track_id.clone());
                                s.duration_ms = duration_ms;
                                s.position_ms = 0;
                                s.playing = true;
                                drop(s);
                                let _ = app.emit("liplay://track-changed", &track_id);
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
                        Command::DspMode(m)        => player.set_dsp_mode(m),
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

// =====================================================================
// Player owns the active Sink and shared DSP parameters.
// =====================================================================

struct Player {
    handle: OutputStreamHandle,
    sink: Option<Sink>,
    eq: Arc<Mutex<(EqChain, EqChain)>>,
    eq_gains: [f32; 10],
    reverb: Arc<Mutex<Freeverb>>,
    fft_consumer: Arc<Mutex<Option<ringbuf::HeapCons<f32>>>>,
    sample_rate_atomic: Arc<std::sync::atomic::AtomicU32>,
    sample_rate: u32,
    crossfade_ms: u32,
    normalize: bool,
    volume: f32,
    dsp_mode: DspMode,
    state: Arc<Mutex<PlaybackState>>,
    last_path: Option<PathBuf>,
    last_track_id: Option<String>,
    last_duration: u64,
}

impl Player {
    fn new(
        handle: OutputStreamHandle,
        state: Arc<Mutex<PlaybackState>>,
        fft_consumer: Arc<Mutex<Option<ringbuf::HeapCons<f32>>>>,
        sample_rate_atomic: Arc<std::sync::atomic::AtomicU32>,
    ) -> Self {
        let sr = 44_100.0;
        let eq = Arc::new(Mutex::new((
            EqChain::new(sr, &[0.0; 10]),
            EqChain::new(sr, &[0.0; 10]),
        )));
        let mut fv = Freeverb::new(sr as u32);
        // Reverb starts dry-only. The DSP mode toggle wets it up.
        fv.set_wet(0.0);
        fv.set_dry(1.0);
        Self {
            handle,
            sink: None,
            eq,
            eq_gains: [0.0; 10],
            reverb: Arc::new(Mutex::new(fv)),
            fft_consumer,
            sample_rate_atomic,
            sample_rate: 44_100,
            crossfade_ms: 0,
            normalize: false,
            volume: 1.0,
            dsp_mode: DspMode::Off,
            state,
            last_path: None,
            last_track_id: None,
            last_duration: 0,
        }
    }

    fn play(&mut self, path: PathBuf, track_id: String, duration_ms: u64) -> Result<()> {
        if let Some(s) = self.sink.take() { s.stop(); }
        self.last_path = Some(path.clone());
        self.last_track_id = Some(track_id);
        self.last_duration = duration_ms;
        self.build_and_start(path)
    }

    fn build_and_start(&mut self, path: PathBuf) -> Result<()> {
        let file = File::open(&path).with_context(|| format!("open {}", path.display()))?;
        let decoded = Decoder::new(BufReader::new(file))
            .with_context(|| format!("decode {}", path.display()))?;

        self.sample_rate = decoded.sample_rate();
        self.sample_rate_atomic.store(self.sample_rate, std::sync::atomic::Ordering::Relaxed);
        *self.eq.lock() = (
            EqChain::new(self.sample_rate as f32, &self.eq_gains),
            EqChain::new(self.sample_rate as f32, &self.eq_gains),
        );
        // Rebuild the reverb at the new SR so the room-tail length is consistent.
        let mut new_fv = Freeverb::new(self.sample_rate);
        let (wet, dry) = match self.dsp_mode {
            DspMode::SlowedReverb => (0.55, 0.6),
            _ => (0.0, 1.0),
        };
        new_fv.set_wet(wet);
        new_fv.set_dry(dry);
        new_fv.set_room(0.92);
        new_fv.set_damping(0.25);
        *self.reverb.lock() = new_fv;

        let speed = match self.dsp_mode {
            DspMode::SlowedReverb => 0.85,
            DspMode::Nightcore    => 1.25,
            DspMode::Off          => 1.0,
        };

        let normalized = if self.normalize {
            decoded.amplify(replay_gain_factor(&path).unwrap_or(1.0))
        } else {
            decoded.amplify(1.0)
        };

        let f32_source = normalized.convert_samples::<f32>().speed(speed);
        let reverb_source = ReverbSource::new(f32_source, self.reverb.clone());
        let eq_source = EqSource::new(reverb_source, self.eq.clone());
        let (fft_source, cons) = FftTapSource::new(eq_source, 8192);
        *self.fft_consumer.lock() = Some(cons);

        let sink = Sink::try_new(&self.handle).context("new sink")?;
        sink.set_volume(self.volume);
        sink.append(fft_source);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    fn pause(&self)  { if let Some(s) = &self.sink { s.pause(); } }
    fn resume(&self) { if let Some(s) = &self.sink { s.play();  } }
    fn stop(&mut self) { if let Some(s) = self.sink.take() { s.stop(); } }

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

    fn set_dsp_mode(&mut self, m: DspMode) {
        if self.dsp_mode == m { return; }
        self.dsp_mode = m;
        // Speed/pitch can only be changed by rebuilding the source chain (rodio's
        // Speed wrapper is per-instance). Reverb wet/dry CAN be tuned live.
        // For the simplest correct behaviour we restart at the current position.
        let resume_pos = self.state.lock().position_ms;
        if let Some(path) = self.last_path.clone() {
            if let Err(e) = self.build_and_start(path) {
                tracing::error!("dsp mode rebuild failed: {e:#}");
                return;
            }
            // Best-effort seek back; many decoders support this on a fresh stream.
            if resume_pos > 0 {
                if let Some(s) = &self.sink {
                    let _ = s.try_seek(Duration::from_millis(resume_pos));
                }
            }
        }
    }

    fn tick(&self) {
        let Some(sink) = &self.sink else { return; };
        if sink.empty() { return; }
        let pos = sink.get_pos();
        let mut s = self.state.lock();
        s.position_ms = pos.as_millis() as u64;
        s.playing = !sink.is_paused() && !sink.empty();
    }
}

// =====================================================================
// FFT pump - reads the SPSC ring at ~30 Hz, emits magnitude bins.
// =====================================================================

fn spawn_fft_pump(
    app: AppHandle,
    fft_consumer: Arc<Mutex<Option<ringbuf::HeapCons<f32>>>>,
    sample_rate: Arc<std::sync::atomic::AtomicU32>,
) {
    use ringbuf::traits::Consumer;
    use rustfft::{num_complex::Complex, FftPlanner};

    tauri::async_runtime::spawn(async move {
        let mut planner = FftPlanner::<f32>::new();
        const N: usize = 1024;
        const BINS: usize = 32;
        let fft = planner.plan_fft_forward(N);
        let mut buf = vec![Complex::<f32>::new(0.0, 0.0); N];
        let mut tmp = vec![0.0f32; N];
        let mut tick = tokio::time::interval(Duration::from_millis(33));
        let window: Vec<f32> = (0..N)
            .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (N as f32 - 1.0)).cos())
            .collect();

        loop {
            tick.tick().await;
            let mut got = 0usize;
            {
                let mut guard = fft_consumer.lock();
                if let Some(cons) = guard.as_mut() {
                    while got < N {
                        match cons.try_pop() {
                            Some(s) => { tmp[got] = s; got += 1; }
                            None => break,
                        }
                    }
                }
            }
            if got < N { continue; }

            for i in 0..N {
                buf[i] = Complex::new(tmp[i] * window[i], 0.0);
            }
            fft.process(&mut buf);

            // Log-spaced bin grouping: emit 32 perceptual buckets covering
            // roughly 40 Hz - 16 kHz so the analyser looks sensible.
            let sr = sample_rate.load(std::sync::atomic::Ordering::Relaxed) as f32;
            let nyquist = sr / 2.0;
            let f_min: f32 = 40.0;
            let f_max: f32 = nyquist.min(16_000.0);
            let mut out = Vec::with_capacity(BINS);
            for b in 0..BINS {
                let lo_hz = f_min * (f_max / f_min).powf(b as f32 / BINS as f32);
                let hi_hz = f_min * (f_max / f_min).powf((b as f32 + 1.0) / BINS as f32);
                let lo = ((lo_hz / nyquist) * (N as f32 / 2.0)) as usize;
                let hi = (((hi_hz / nyquist) * (N as f32 / 2.0)) as usize).min(N / 2);
                let mut sum = 0.0f32;
                let mut count = 0usize;
                for k in lo..hi.max(lo + 1) {
                    sum += buf[k].norm();
                    count += 1;
                }
                let avg = if count > 0 { sum / count as f32 } else { 0.0 };
                // Soft compression: dB-like scale, normalised.
                let mag = (avg / 50.0).powf(0.5).clamp(0.0, 1.0);
                out.push(mag);
            }
            let _ = app.emit("liplay://spectrum", &out);
        }
    });
}

fn replay_gain_factor(path: &std::path::Path) -> Option<f32> {
    use lofty::prelude::*;
    use lofty::probe::Probe;
    use lofty::tag::ItemKey;

    let probed = Probe::open(path).ok()?.guess_file_type().ok()?.read().ok()?;
    let tag = probed.primary_tag().or_else(|| probed.first_tag())?;
    let raw = tag.get_string(&ItemKey::ReplayGainTrackGain)?;
    let trimmed = raw.trim_end_matches(|c: char| !c.is_ascii_digit() && c != '.' && c != '-');
    let db: f32 = trimmed.parse().ok()?;
    Some(10f32.powf(db / 20.0))
}
