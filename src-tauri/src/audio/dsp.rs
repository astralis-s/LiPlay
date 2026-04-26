//! 10-band biquad-based parametric equalizer.
//!
//! Each band is a peaking EQ filter (Robert Bristow-Johnson cookbook
//! coefficients) with a fixed Q. Gains are in dB; 0 dB = bypass.
//! Filters are independent per channel (stereo) and operate on f32 samples.

#[derive(Clone, Copy, Debug)]
pub struct Biquad {
    b0: f32, b1: f32, b2: f32,
    a1: f32, a2: f32,
    z1: f32, z2: f32,
}

impl Biquad {
    pub fn peaking(sample_rate: f32, freq: f32, q: f32, gain_db: f32) -> Self {
        let a = 10f32.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let cos_w0 = w0.cos();
        let alpha = w0.sin() / (2.0 * q);

        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha / a;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    pub fn identity() -> Self {
        Self { b0: 1.0, b1: 0.0, b2: 0.0, a1: 0.0, a2: 0.0, z1: 0.0, z2: 0.0 }
    }

    /// Clear delay-line state without touching the coefficients. Used after
    /// a seek to avoid filter memory bleeding across the discontinuity.
    pub fn clear_state(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        // Transposed Direct Form II.
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

pub const EQ_FREQS: [f32; 10] = [
    31.25, 62.5, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];
pub const EQ_Q: f32 = 1.0;

#[derive(Clone)]
pub struct EqChain {
    pub bands: [Biquad; 10],
}

impl EqChain {
    pub fn new(sample_rate: f32, gains_db: &[f32; 10]) -> Self {
        let mut bands = [Biquad::identity(); 10];
        for i in 0..10 {
            bands[i] = Biquad::peaking(sample_rate, EQ_FREQS[i], EQ_Q, gains_db[i]);
        }
        Self { bands }
    }

    #[inline]
    pub fn process(&mut self, mut x: f32) -> f32 {
        for b in self.bands.iter_mut() { x = b.process(x); }
        x
    }
}
