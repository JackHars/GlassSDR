//! Decimation chain: a FIR low-pass filter followed by integer downsampling.
//! Operates on Complex32. For v0.1 we use a fixed Hann-windowed sinc with
//! configurable taps and decimation factor.

use num_complex::Complex32;

pub struct FirDecimator {
    taps: Vec<f32>,
    decim: usize,
    history: Vec<Complex32>, // length == taps.len() - 1
    phase: usize,
}

impl FirDecimator {
    /// `cutoff_hz` is the desired LPF cutoff at the input sample rate.
    /// `sample_rate_hz` is the *input* sample rate.
    /// `decim` is the integer downsampling factor.
    /// `num_taps` should be odd for symmetric FIR.
    pub fn new(cutoff_hz: f32, sample_rate_hz: f32, decim: usize, num_taps: usize) -> Self {
        assert!(num_taps % 2 == 1, "num_taps must be odd");
        assert!(decim >= 1);
        let taps = hann_windowed_sinc(cutoff_hz, sample_rate_hz, num_taps);
        Self {
            history: vec![Complex32::new(0.0, 0.0); num_taps - 1],
            taps,
            decim,
            phase: 0,
        }
    }

    /// Process a slice of input samples, append decimated output to `out`.
    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<Complex32>) {
        for &x in input {
            // shift history
            self.history.rotate_right(1);
            self.history[0] = x;
            // emit on phase 0
            if self.phase == 0 {
                let mut acc = Complex32::new(0.0, 0.0);
                acc += x * self.taps[0];
                for (i, &h) in self.history.iter().enumerate() {
                    acc += h * self.taps[i + 1];
                }
                out.push(acc);
            }
            self.phase = (self.phase + 1) % self.decim;
        }
    }
}

fn hann_windowed_sinc(cutoff_hz: f32, sample_rate_hz: f32, num_taps: usize) -> Vec<f32> {
    let m = num_taps as f32 - 1.0;
    let fc = cutoff_hz / sample_rate_hz; // normalized cutoff
    let mut taps = Vec::with_capacity(num_taps);
    for n in 0..num_taps {
        let nf = n as f32;
        let x = nf - m / 2.0;
        let sinc_v = if x.abs() < f32::EPSILON {
            2.0 * fc
        } else {
            (2.0 * std::f32::consts::PI * fc * x).sin() / (std::f32::consts::PI * x)
        };
        let hann = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * nf / m).cos();
        taps.push(sinc_v * hann);
    }
    // Normalize for unity DC gain
    let sum: f32 = taps.iter().sum();
    for t in taps.iter_mut() {
        *t /= sum;
    }
    taps
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn decimator_passes_dc() {
        let mut d = FirDecimator::new(50_000.0, 2_400_000.0, 4, 65);
        let input = vec![Complex32::new(1.0, 0.0); 256];
        let mut out = Vec::new();
        d.process(&input, &mut out);
        assert_eq!(out.len(), 64);
        // After settling, output should approach 1.0
        let last = out.last().unwrap();
        assert_relative_eq!(last.re, 1.0, epsilon = 0.05);
        assert_relative_eq!(last.im, 0.0, epsilon = 0.05);
    }

    #[test]
    fn taps_have_unit_dc_gain() {
        let taps = hann_windowed_sinc(50_000.0, 2_400_000.0, 65);
        let sum: f32 = taps.iter().sum();
        assert_relative_eq!(sum, 1.0, epsilon = 1e-5);
    }
}
