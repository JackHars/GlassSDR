//! Wideband scanner engine types and power measurement utilities.
//! The actual scan loop lives in the app; this provides the computation.

use num_complex::Complex32;
use std::f32::consts::PI;

#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub start_hz: f64,
    pub stop_hz: f64,
    pub step_hz: f64,
    pub dwell_ms: u32,
    pub fft_size: usize,
    pub squelch_db: f32,
}

impl ScanConfig {
    pub fn num_steps(&self) -> usize {
        ((self.stop_hz - self.start_hz) / self.step_hz).ceil() as usize + 1
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.start_hz >= self.stop_hz { return Err("start must be < stop".into()); }
        if self.step_hz <= 0.0 { return Err("step must be positive".into()); }
        if self.dwell_ms == 0 { return Err("dwell must be > 0".into()); }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub freq_hz: f64,
    pub power_db: f32,
}

/// Compute average power (dB) from IQ samples.
pub fn measure_power_db(samples: &[Complex32]) -> f32 {
    if samples.is_empty() { return -100.0; }
    let sum: f32 = samples.iter().map(|s| s.norm_sqr()).sum();
    let avg = sum / samples.len() as f32;
    10.0 * avg.max(1e-12).log10()
}

/// Compute power spectrum via DFT (for small FFT sizes used in scanning).
/// Returns power in dB per bin.
pub fn power_spectrum(samples: &[Complex32], fft_size: usize) -> Vec<f32> {
    let n = samples.len().min(fft_size);
    let mut spectrum = vec![-100.0f32; fft_size];

    for k in 0..fft_size {
        let mut re = 0.0f32;
        let mut im = 0.0f32;
        for (i, s) in samples.iter().take(n).enumerate() {
            let angle = -2.0 * PI * k as f32 * i as f32 / fft_size as f32;
            re += s.re * angle.cos() - s.im * angle.sin();
            im += s.re * angle.sin() + s.im * angle.cos();
        }
        let mag_sq = (re * re + im * im) / n as f32;
        spectrum[k] = 10.0 * mag_sq.max(1e-12).log10();
    }
    spectrum
}
