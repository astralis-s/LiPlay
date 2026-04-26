//! Custom rodio Sources for EQ and gain (volume normalization).
//!
//! These wrap any other Source<Item = f32> and apply per-sample DSP. They
//! share their parameters via Arc<Mutex<...>> so the main thread can mutate
//! EQ bands or normalization gain in real time without restarting the stream.

use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use rodio::source::SeekError;
use rodio::Source;

use super::dsp::EqChain;

pub struct EqSource<I> {
    inner: I,
    chains: Arc<Mutex<(EqChain, EqChain)>>, // (left, right)
    channel_idx: u16,
    channels: u16,
}

impl<I> EqSource<I>
where I: Source<Item = f32>,
{
    pub fn new(inner: I, chains: Arc<Mutex<(EqChain, EqChain)>>) -> Self {
        let channels = inner.channels();
        Self { inner, chains, channel_idx: 0, channels }
    }
}

impl<I> Iterator for EqSource<I>
where I: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let s = self.inner.next()?;
        let mut g = self.chains.lock();
        let out = if self.channel_idx == 0 { g.0.process(s) } else { g.1.process(s) };
        self.channel_idx = (self.channel_idx + 1) % self.channels.max(1);
        Some(out.clamp(-1.0, 1.0))
    }
}

impl<I> Source for EqSource<I>
where I: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> { self.inner.current_frame_len() }
    fn channels(&self) -> u16 { self.inner.channels() }
    fn sample_rate(&self) -> u32 { self.inner.sample_rate() }
    fn total_duration(&self) -> Option<Duration> { self.inner.total_duration() }

    /// Forward seeks to the inner Source. Without this, `Sink::try_seek`
    /// silently returns NotSupported because the wrapper chain reports no
    /// seek capability  the seekbar in the UI then snaps back.
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        // Reset the EQ state so the seek doesn't bleed filter memory across
        // a discontinuity (causes a brief click otherwise).
        let mut g = self.chains.lock();
        for b in g.0.bands.iter_mut() { b.clear_state(); }
        for b in g.1.bands.iter_mut() { b.clear_state(); }
        drop(g);
        self.channel_idx = 0;
        self.inner.try_seek(pos)
    }
}
