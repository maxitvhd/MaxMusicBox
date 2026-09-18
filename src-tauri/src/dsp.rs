// Pipeline de Processamento de Sinal em Tempo Real (DSP) - MaxMusicBox
// EQ 5 bandas (biquad), Compressor, AGC, Limiter, Master Gain + métricas (RMS / Spectrum)
use rodio::Source;
use rustfft::{num_complex::Complex, FftPlanner};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

const PI: f32 = std::f32::consts::PI;

#[inline]
fn fbits(v: f32) -> u32 {
    v.to_bits()
}
#[inline]
fn ffrom(b: u32) -> f32 {
    f32::from_bits(b)
}

/// Parâmetros DSP compartilhados entre a thread de comandos e a thread de áudio.
pub struct DspParams {
    version: AtomicU64,
    eq: [AtomicU32; 5],
    comp_threshold: AtomicU32,
    comp_ratio: AtomicU32,
    comp_attack: AtomicU32,
    comp_release: AtomicU32,
    agc_active: AtomicBool,
    agc_sensitivity: AtomicU32,
    limiter_ceiling: AtomicU32,
    master_gain: AtomicU32,
}

impl DspParams {
    pub fn new() -> Self {
        Self {
            version: AtomicU64::new(1),
            eq: [
                AtomicU32::new(fbits(0.0)),
                AtomicU32::new(fbits(0.0)),
                AtomicU32::new(fbits(0.0)),
                AtomicU32::new(fbits(0.0)),
                AtomicU32::new(fbits(0.0)),
            ],
            comp_threshold: AtomicU32::new(fbits(-20.0)),
            comp_ratio: AtomicU32::new(fbits(4.0)),
            comp_attack: AtomicU32::new(fbits(0.02)),
            comp_release: AtomicU32::new(fbits(0.25)),
            agc_active: AtomicBool::new(true),
            agc_sensitivity: AtomicU32::new(fbits(60.0)),
            limiter_ceiling: AtomicU32::new(fbits(-1.0)),
            master_gain: AtomicU32::new(fbits(0.85)),
        }
    }

    #[inline]
    fn bump(&self) {
        self.version.fetch_add(1, Ordering::SeqCst);
    }

    pub fn set_eq(&self, band: usize, gain: f32) {
        if band < 5 {
            self.eq[band].store(fbits(gain.clamp(-12.0, 12.0)), Ordering::SeqCst);
            self.bump();
        }
    }

    pub fn set_compressor(&self, threshold: f32, ratio: f32, attack: f32, release: f32) {
        self.comp_threshold
            .store(fbits(threshold.clamp(-60.0, 0.0)), Ordering::SeqCst);
        self.comp_ratio
            .store(fbits(ratio.clamp(1.0, 20.0)), Ordering::SeqCst);
        self.comp_attack
            .store(fbits(attack.clamp(0.001, 0.5)), Ordering::SeqCst);
        self.comp_release
            .store(fbits(release.clamp(0.02, 1.0)), Ordering::SeqCst);
        self.bump();
    }

    pub fn set_agc(&self, active: bool, sensitivity: f32) {
        self.agc_active.store(active, Ordering::SeqCst);
        self.agc_sensitivity
            .store(fbits(sensitivity.clamp(0.0, 100.0)), Ordering::SeqCst);
        self.bump();
    }

    pub fn set_limiter(&self, ceiling: f32) {
        self.limiter_ceiling
            .store(fbits(ceiling.clamp(-24.0, 0.0)), Ordering::SeqCst);
        self.bump();
    }

    pub fn set_master(&self, vol: f32) {
        self.master_gain
            .store(fbits(vol.clamp(0.0, 1.5)), Ordering::SeqCst);
    }
}

impl Default for DspParams {
    fn default() -> Self {
        Self::new()
    }
}

/// Métricas consumidas pela thread emissora de eventos (60fps).
pub struct Meters {
    pub rms_l: AtomicU32,
    pub rms_r: AtomicU32,
    pub peak_l: AtomicU32,
    pub peak_r: AtomicU32,
    pub position_frames: AtomicU64,
    pub sample_rate: AtomicU32,
    pub ended: AtomicBool,
    pub spectrum: [AtomicU32; 16],
}

impl Meters {
    pub fn new() -> Self {
        Self {
            rms_l: AtomicU32::new(0),
            rms_r: AtomicU32::new(0),
            peak_l: AtomicU32::new(0),
            peak_r: AtomicU32::new(0),
            position_frames: AtomicU64::new(0),
            sample_rate: AtomicU32::new(44100),
            ended: AtomicBool::new(false),
            spectrum: std::array::from_fn(|_| AtomicU32::new(0)),
        }
    }

    pub fn get_rms(&self) -> (f32, f32) {
        (
            ffrom(self.rms_l.load(Ordering::Relaxed)),
            ffrom(self.rms_r.load(Ordering::Relaxed)),
        )
    }

    pub fn get_peaks(&self) -> (f32, f32) {
        (
            ffrom(self.peak_l.load(Ordering::Relaxed)),
            ffrom(self.peak_r.load(Ordering::Relaxed)),
        )
    }

    pub fn get_spectrum(&self) -> Vec<f32> {
        self.spectrum
            .iter()
            .map(|a| ffrom(a.load(Ordering::Relaxed)))
            .collect()
    }

    /// Zera as métricas (ao pausar/parar) para os VUs caírem em vez de congelar.
    pub fn reset(&self) {
        for a in [
            &self.rms_l,
            &self.rms_r,
            &self.peak_l,
            &self.peak_r,
        ] {
            a.store(fbits(0.0), Ordering::Relaxed);
        }
        for s in &self.spectrum {
            s.store(fbits(0.0), Ordering::Relaxed);
        }
    }
}

impl Default for Meters {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Copy, Default)]
struct BiquadState {
    z1: f32,
    z2: f32,
}

#[derive(Clone, Copy)]
struct Coeff {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

impl Default for Coeff {
    fn default() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        }
    }
}

impl Coeff {
    #[inline]
    fn process(&self, st: &mut BiquadState, x: f32) -> f32 {
        let y = self.b0 * x + st.z1;
        st.z1 = self.b1 * x - self.a1 * y + st.z2;
        st.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

fn peaking(fs: f32, f0: f32, q: f32, db: f32) -> Coeff {
    let a = 10f32.powf(db / 40.0);
    let w0 = 2.0 * PI * f0 / fs;
    let cosw = w0.cos();
    let alpha = w0.sin() / (2.0 * q);
    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cosw;
    let b2 = 1.0 - alpha * a;
    let a0 = 1.0 + alpha / a;
    let a1 = -2.0 * cosw;
    let a2 = 1.0 - alpha / a;
    Coeff {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
    }
}

fn lowshelf(fs: f32, f0: f32, db: f32) -> Coeff {
    let a = 10f32.powf(db / 40.0);
    let w0 = 2.0 * PI * f0 / fs;
    let cosw = w0.cos();
    let sinw = w0.sin();
    let alpha = sinw / 2.0 * ((a + 1.0 / a) * (1.0 / 1.0 - 1.0) + 2.0).sqrt();
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
    let b0 = a * ((a + 1.0) - (a - 1.0) * cosw + two_sqrt_a_alpha);
    let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cosw);
    let b2 = a * ((a + 1.0) - (a - 1.0) * cosw - two_sqrt_a_alpha);
    let a0 = (a + 1.0) + (a - 1.0) * cosw + two_sqrt_a_alpha;
    let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cosw);
    let a2 = (a + 1.0) + (a - 1.0) * cosw - two_sqrt_a_alpha;
    Coeff {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
    }
}

fn highshelf(fs: f32, f0: f32, db: f32) -> Coeff {
    let a = 10f32.powf(db / 40.0);
    let w0 = 2.0 * PI * f0 / fs;
    let cosw = w0.cos();
    let sinw = w0.sin();
    let alpha = sinw / 2.0 * ((a + 1.0 / a) * (1.0 / 1.0 - 1.0) + 2.0).sqrt();
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
    let b0 = a * ((a + 1.0) + (a - 1.0) * cosw + two_sqrt_a_alpha);
    let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cosw);
    let b2 = a * ((a + 1.0) + (a - 1.0) * cosw - two_sqrt_a_alpha);
    let a0 = (a + 1.0) - (a - 1.0) * cosw + two_sqrt_a_alpha;
    let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cosw);
    let a2 = (a + 1.0) - (a - 1.0) * cosw - two_sqrt_a_alpha;
    Coeff {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
    }
}

fn eq_coeffs(fs: f32, gains: [f32; 5]) -> [Coeff; 5] {
    [
        lowshelf(fs, 80.0, gains[0]),
        peaking(fs, 350.0, 1.0, gains[1]),
        peaking(fs, 1000.0, 1.0, gains[2]),
        peaking(fs, 4000.0, 1.0, gains[3]),
        highshelf(fs, 12000.0, gains[4]),
    ]
}

/// Fonte de áudio que aplica o pipeline DSP amostra a amostra.
pub struct DspSource<S> {
    inner: S,
    params: Arc<DspParams>,
    meters: Arc<Meters>,
    sample_rate: u32,
    channels: u16,
    ch: u16,
    coeffs: [Coeff; 5],
    states: Vec<[BiquadState; 5]>,
    comp_env: Vec<f32>,
    comp_gain: Vec<f32>,
    agc_gain: f32,
    agc_rms: f32,
    rms_acc: Vec<f32>,
    rms_n: u32,
    rms_block: u32,
    peak: Vec<f32>,
    spec_buf: Vec<f32>,
    spec_pos: usize,
    fft: Arc<dyn rustfft::Fft<f32>>,
    // parâmetros em cache
    p_ver: u64,
    p_threshold: f32,
    p_ratio: f32,
    p_a_att: f32,
    p_a_rel: f32,
    p_agc: bool,
    p_agc_target: f32,
    p_ceil: f32,
    p_master: f32,
}

impl<S: Source<Item = f32>> DspSource<S> {
    pub fn new(inner: S, params: Arc<DspParams>, meters: Arc<Meters>) -> Self {
        let sample_rate = inner.sample_rate().max(8000);
        let channels = inner.channels().max(1);
        let nch = channels as usize;
        meters
            .sample_rate
            .store(sample_rate, Ordering::SeqCst);
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(1024);
        Self {
            inner,
            params,
            meters,
            sample_rate,
            channels,
            ch: 0,
            coeffs: [Coeff::default(); 5],
            states: vec![[BiquadState::default(); 5]; nch],
            comp_env: vec![0.0; nch],
            comp_gain: vec![1.0; nch],
            agc_gain: 1.0,
            agc_rms: 0.0,
            rms_acc: vec![0.0; nch],
            rms_n: 0,
            rms_block: (sample_rate / 50).max(64),
            peak: vec![0.0; nch],
            spec_buf: vec![0.0; 1024],
            spec_pos: 0,
            fft,
            p_ver: 0,
            p_threshold: -20.0,
            p_ratio: 4.0,
            p_a_att: 0.0,
            p_a_rel: 0.0,
            p_agc: true,
            p_agc_target: 0.35,
            p_ceil: 0.9,
            p_master: 0.85,
        }
    }

    #[inline]
    fn sync_params(&mut self) {
        let ver = self.params.version.load(Ordering::Relaxed);
        if ver == self.p_ver && self.p_ver != 0 {
            return;
        }
        self.p_ver = ver;
        let fs = self.sample_rate as f32;
        let gains = [
            ffrom(self.params.eq[0].load(Ordering::Relaxed)),
            ffrom(self.params.eq[1].load(Ordering::Relaxed)),
            ffrom(self.params.eq[2].load(Ordering::Relaxed)),
            ffrom(self.params.eq[3].load(Ordering::Relaxed)),
            ffrom(self.params.eq[4].load(Ordering::Relaxed)),
        ];
        self.coeffs = eq_coeffs(fs, gains);

        self.p_threshold = ffrom(self.params.comp_threshold.load(Ordering::Relaxed));
        self.p_ratio = ffrom(self.params.comp_ratio.load(Ordering::Relaxed));
        let attack = ffrom(self.params.comp_attack.load(Ordering::Relaxed)).max(0.001);
        let release = ffrom(self.params.comp_release.load(Ordering::Relaxed)).max(0.02);
        self.p_a_att = (-1.0 / (fs * attack)).exp();
        self.p_a_rel = (-1.0 / (fs * release)).exp();
        self.p_agc = self.params.agc_active.load(Ordering::Relaxed);
        let sens = ffrom(self.params.agc_sensitivity.load(Ordering::Relaxed));
        self.p_agc_target = 0.08 + (sens / 100.0) * 0.42;
        let ceil_db = ffrom(self.params.limiter_ceiling.load(Ordering::Relaxed));
        self.p_ceil = 10f32.powf(ceil_db / 20.0);
        self.p_master = ffrom(self.params.master_gain.load(Ordering::Relaxed));
    }

    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        self.sync_params();
        let ch = self.ch as usize;
        let mut s = x;

        for b in 0..5 {
            let c = self.coeffs[b];
            s = c.process(&mut self.states[ch][b], s);
        }

        // Compressor
        let level = s.abs();
        if level > self.comp_env[ch] {
            self.comp_env[ch] = self.p_a_att * self.comp_env[ch] + (1.0 - self.p_a_att) * level;
        } else {
            self.comp_env[ch] = self.p_a_rel * self.comp_env[ch] + (1.0 - self.p_a_rel) * level;
        }
        let env_db = 20.0 * self.comp_env[ch].max(1e-6).log10();
        let gr_db = if env_db > self.p_threshold {
            (self.p_threshold - env_db) * (1.0 - 1.0 / self.p_ratio)
        } else {
            0.0
        };
        let target = 10f32.powf(gr_db / 20.0);
        if target < self.comp_gain[ch] {
            self.comp_gain[ch] = self.p_a_att * self.comp_gain[ch] + (1.0 - self.p_a_att) * target;
        } else {
            self.comp_gain[ch] = self.p_a_rel * self.comp_gain[ch] + (1.0 - self.p_a_rel) * target;
        }
        s *= self.comp_gain[ch];

        // AGC
        if self.p_agc {
            self.agc_rms += (level - self.agc_rms) * 0.0005;
            if self.agc_rms > 1e-5 {
                let desired = self.p_agc_target / self.agc_rms;
                self.agc_gain += (desired - self.agc_gain) * 0.0004;
                self.agc_gain = self.agc_gain.clamp(0.2, 3.5);
            }
            s *= self.agc_gain;
        } else {
            self.agc_gain += (1.0 - self.agc_gain) * 0.01;
            s *= self.agc_gain;
        }

        // Limiter (brickwall)
        if s > self.p_ceil {
            s = self.p_ceil;
        } else if s < -self.p_ceil {
            s = -self.p_ceil;
        }

        // Master
        s *= self.p_master;

        // ----- Métricas -----
        self.rms_acc[ch] += s * s;
        let a = s.abs();
        if a > self.peak[ch] {
            self.peak[ch] = a;
        }

        // FFT buffer (downmix)
        self.spec_buf[self.spec_pos] += s / self.channels as f32;

        self.ch += 1;
        if self.ch >= self.channels {
            self.ch = 0;
            self.spec_pos += 1;

            // Atualiza RMS a cada bloco
            self.rms_n += 1;
            if self.rms_n >= self.rms_block {
                let inv = 1.0 / self.rms_block as f32;
                let l = (self.rms_acc[0] * inv).sqrt();
                let r = if self.channels > 1 {
                    (self.rms_acc[1] * inv).sqrt()
                } else {
                    l
                };
                self.meters
                    .rms_l
                    .store(fbits(l.min(1.0)), Ordering::Relaxed);
                self.meters
                    .rms_r
                    .store(fbits(r.min(1.0)), Ordering::Relaxed);
                self.meters
                    .peak_l
                    .store(fbits(self.peak[0].min(1.0)), Ordering::Relaxed);
                let pr = if self.channels > 1 {
                    self.peak[1]
                } else {
                    self.peak[0]
                };
                self.meters
                    .peak_r
                    .store(fbits(pr.min(1.0)), Ordering::Relaxed);
                self.rms_acc.iter_mut().for_each(|v| *v = 0.0);
                self.peak.iter_mut().for_each(|v| *v = 0.0);
                self.rms_n = 0;
            }

            self.meters
                .position_frames
                .fetch_add(1, Ordering::Relaxed);

            // FFT a cada 1024 frames
            if self.spec_pos >= 1024 {
                self.compute_spectrum();
                self.spec_buf.iter_mut().for_each(|v| *v = 0.0);
                self.spec_pos = 0;
            }
        }

        s
    }

    fn compute_spectrum(&mut self) {
        let mut buf: Vec<Complex<f32>> = self
            .spec_buf
            .iter()
            .map(|&v| Complex { re: v, im: 0.0 })
            .collect();
        self.fft.process(&mut buf);

        let sr = self.sample_rate as f32;
        let n = 1024usize;
        // Magnitude de referência: uma senoide em fundo de escala ocupa n/2 em um bin.
        let mag_ref = n as f32 / 2.0;
        // 16 bandas logarítmicas entre 40Hz e 16kHz
        let fmin = 40f32;
        let fmax = (sr / 2.0).min(16000.0);
        let mut bands = [0f32; 16];
        for (i, band) in bands.iter_mut().enumerate() {
            let f0 = fmin * (fmax / fmin).powf(i as f32 / 16.0);
            let f1 = fmin * (fmax / fmin).powf((i + 1) as f32 / 16.0);
            let k0 = ((f0 / sr) * n as f32).round() as usize;
            let k1 = ((f1 / sr) * n as f32).round() as usize;
            let k0 = k0.clamp(1, n / 2 - 1);
            let k1 = k1.clamp(k0 + 1, n / 2);
            // Pico de magnitude da banda (resposta visual mais rápida que a média).
            let mut peak = 0.0f32;
            for c in &buf[k0..k1] {
                let m = c.norm();
                if m > peak {
                    peak = m;
                }
            }
            // Escala em dB: -66dB (silêncio) .. 0dB (fundo de escala) -> 0..1
            let db = 20.0 * (peak / mag_ref).max(1e-6).log10();
            let norm = ((db + 66.0) / 66.0).clamp(0.0, 1.0);
            // Gama para os LEDs reagirem de forma mais viva na faixa média.
            *band = norm.powf(0.6);
        }

        for (i, b) in bands.iter().enumerate() {
            self.meters.spectrum[i].store(fbits(*b), Ordering::Relaxed);
        }
    }
}

impl<S: Source<Item = f32>> Iterator for DspSource<S> {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        match self.inner.next() {
            Some(x) => Some(self.process(x)),
            None => {
                self.meters.ended.store(true, Ordering::SeqCst);
                None
            }
        }
    }
}

impl<S: Source<Item = f32>> Source for DspSource<S> {
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }
    fn channels(&self) -> u16 {
        self.inner.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}
