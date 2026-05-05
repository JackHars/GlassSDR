//! Quadrature FM demodulator: instantaneous frequency = arg(z[n] * conj(z[n-1]))
//! scaled to [-1, 1] for ±max_deviation.

use num_complex::Complex32;

pub struct QuadDemod {
    last: Complex32,
    /// scale factor: 1 / (2π * max_deviation_hz / sample_rate_hz)
    scale: f32,
}

impl QuadDemod {
    pub fn new(max_deviation_hz: f32, sample_rate_hz: f32) -> Self {
        let normalized_max = max_deviation_hz / sample_rate_hz;
        let scale = 1.0 / (2.0 * std::f32::consts::PI * normalized_max);
        Self {
            last: Complex32::new(1.0, 0.0),
            scale,
        }
    }

    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<f32>) {
        for &x in input {
            let prod = x * self.last.conj();
            let phase = prod.arg();
            out.push(phase * self.scale);
            self.last = x;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    use std::f32::consts::PI;

    #[test]
    fn constant_freq_gives_constant_output() {
        // Generate a tone at +5 kHz in a 240 kHz stream, max_dev = 5 kHz → expect output ≈ 1.0
        let sr = 240_000.0;
        let f = 5_000.0;
        let n = 1024;
        let mut input = Vec::with_capacity(n);
        for k in 0..n {
            let t = k as f32 / sr;
            input.push(Complex32::from_polar(1.0, 2.0 * PI * f * t));
        }
        let mut demod = QuadDemod::new(f, sr);
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        let avg = out.iter().skip(2).sum::<f32>() / (out.len() - 2) as f32;
        assert_relative_eq!(avg, 1.0, epsilon = 0.01);
    }

    #[test]
    fn opposite_freq_gives_negative_output() {
        let sr = 240_000.0;
        let f = -5_000.0;
        let n = 1024;
        let mut input = Vec::with_capacity(n);
        for k in 0..n {
            let t = k as f32 / sr;
            input.push(Complex32::from_polar(1.0, 2.0 * PI * f * t));
        }
        let mut demod = QuadDemod::new(5_000.0, sr);
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        let avg = out.iter().skip(2).sum::<f32>() / (out.len() - 2) as f32;
        assert_relative_eq!(avg, -1.0, epsilon = 0.01);
    }
}
