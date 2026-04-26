//! Freeverb - Jezar at Dreampoint's classic public-domain reverb.
//!
//! Each channel has 8 lowpass-feedback comb filters in parallel followed by
//! 4 allpass filters in series. We instantiate two of these and operate per
//! interleaved sample. All buffer sizes are scaled to the engine sample
//! rate so the reverb sounds tonally consistent regardless of source rate.

const NUM_COMBS: usize = 8;
const NUM_ALLPASSES: usize = 4;

// Original Freeverb buffer lengths (samples) at 44.1 kHz.
const COMB_TUNING_L: [usize; NUM_COMBS] = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const COMB_TUNING_R: [usize; NUM_COMBS] = [1139, 1211, 1300, 1379, 1445, 1514, 1580, 1640];
const ALLPASS_TUNING_L: [usize; NUM_ALLPASSES] = [556, 441, 341, 225];
const ALLPASS_TUNING_R: [usize; NUM_ALLPASSES] = [579, 464, 364, 246];

// Algorithm constants from the original.
const FIXED_GAIN: f32 = 0.015;
const SCALE_DAMP: f32 = 0.4;
const SCALE_ROOM: f32 = 0.28;
const OFFSET_ROOM: f32 = 0.7;
const ALLPASS_FEEDBACK: f32 = 0.5;
const STEREO_SPREAD: usize = 23;

struct Comb {
    buf: Vec<f32>,
    idx: usize,
    feedback: f32,
    damp1: f32,
    damp2: f32,
    last: f32,
}

impl Comb {
    fn new(size: usize) -> Self {
        Self { buf: vec![0.0; size], idx: 0, feedback: 0.84, damp1: 0.2, damp2: 0.8, last: 0.0 }
    }

    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        let out = self.buf[self.idx];
        self.last = out * self.damp2 + self.last * self.damp1;
        self.buf[self.idx] = x + self.last * self.feedback;
        self.idx += 1;
        if self.idx == self.buf.len() { self.idx = 0; }
        out
    }
}

struct Allpass {
    buf: Vec<f32>,
    idx: usize,
}

impl Allpass {
    fn new(size: usize) -> Self {
        Self { buf: vec![0.0; size], idx: 0 }
    }

    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        let bufout = self.buf[self.idx];
        let out = -x + bufout;
        self.buf[self.idx] = x + bufout * ALLPASS_FEEDBACK;
        self.idx += 1;
        if self.idx == self.buf.len() { self.idx = 0; }
        out
    }
}

pub struct Freeverb {
    combs_l: Vec<Comb>,
    combs_r: Vec<Comb>,
    aps_l:   Vec<Allpass>,
    aps_r:   Vec<Allpass>,
    /// Wet/dry mix in [0, 1]. 0 = dry only.
    pub wet: f32,
    pub dry: f32,
    pub width: f32,
    pub room_size: f32,
    pub damping: f32,
}

impl Freeverb {
    pub fn new(sample_rate: u32) -> Self {
        let scale = sample_rate as f32 / 44_100.0;
        let combs_l = COMB_TUNING_L.iter().map(|&s| Comb::new(((s as f32) * scale) as usize)).collect();
        let combs_r = COMB_TUNING_R.iter().map(|&s| Comb::new((((s + STEREO_SPREAD) as f32) * scale) as usize)).collect();
        let aps_l   = ALLPASS_TUNING_L.iter().map(|&s| Allpass::new(((s as f32) * scale) as usize)).collect();
        let aps_r   = ALLPASS_TUNING_R.iter().map(|&s| Allpass::new((((s + STEREO_SPREAD) as f32) * scale) as usize)).collect();
        let mut me = Self {
            combs_l, combs_r, aps_l, aps_r,
            wet: 0.5, dry: 0.5, width: 1.0, room_size: 0.85, damping: 0.35,
        };
        me.update_combs();
        me
    }

    pub fn set_room(&mut self, room: f32) {
        self.room_size = room.clamp(0.0, 1.0);
        self.update_combs();
    }
    pub fn set_damping(&mut self, d: f32) {
        self.damping = d.clamp(0.0, 1.0);
        self.update_combs();
    }
    pub fn set_wet(&mut self, w: f32) { self.wet = w.clamp(0.0, 1.0); }
    pub fn set_dry(&mut self, d: f32) { self.dry = d.clamp(0.0, 1.0); }

    fn update_combs(&mut self) {
        let feedback = self.room_size * SCALE_ROOM + OFFSET_ROOM;
        let damp1 = self.damping * SCALE_DAMP;
        let damp2 = 1.0 - damp1;
        for c in self.combs_l.iter_mut().chain(self.combs_r.iter_mut()) {
            c.feedback = feedback;
            c.damp1 = damp1;
            c.damp2 = damp2;
        }
    }

    pub fn clear_state(&mut self) {
        for c in self.combs_l.iter_mut().chain(self.combs_r.iter_mut()) {
            c.buf.fill(0.0); c.last = 0.0;
        }
        for a in self.aps_l.iter_mut().chain(self.aps_r.iter_mut()) {
            a.buf.fill(0.0);
        }
    }

    /// Process a stereo sample pair. Returns (out_l, out_r).
    #[inline]
    pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        let input = (in_l + in_r) * FIXED_GAIN;
        let mut out_l = 0.0;
        let mut out_r = 0.0;
        for c in self.combs_l.iter_mut() { out_l += c.process(input); }
        for c in self.combs_r.iter_mut() { out_r += c.process(input); }
        for a in self.aps_l.iter_mut()   { out_l = a.process(out_l); }
        for a in self.aps_r.iter_mut()   { out_r = a.process(out_r); }
        let wet1 = self.wet * (self.width / 2.0 + 0.5);
        let wet2 = self.wet * ((1.0 - self.width) / 2.0);
        let l = out_l * wet1 + out_r * wet2 + in_l * self.dry;
        let r = out_r * wet1 + out_l * wet2 + in_r * self.dry;
        (l.clamp(-1.0, 1.0), r.clamp(-1.0, 1.0))
    }
}
