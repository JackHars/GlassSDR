//! OOK envelope detector: magnitude → smoothing → adaptive threshold → binary output.
//! Input: Complex32 IQ samples.
//! Output: u8 (0=low, 1=high) binary pulse train.

use num_complex::Complex32;

pub struct OokEnvelope {
    smooth_buf: Vec<f32>,
    smooth_idx: usize,
    smooth_sum: f32,
    threshold_factor: f32,
    noise_floor: f32,
    noise_alpha: f32,
}

impl OokEnvelope {
    /// Create OOK envelope detector.
    /// - `smooth_window`: moving-average window size.
    /// - `threshold_factor`: signal must be this many times above noise floor.
    /// - `noise_alpha`: IIR tracking speed for noise floor.
    pub fn new(smooth_window: usize, threshold_factor: f32, noise_alpha: f32) -> Self {
        Self {
            smooth_buf: vec![0.0; smooth_window],
            smooth_idx: 0,
            smooth_sum: 0.0,
            threshold_factor,
            noise_floor: 0.001,
            noise_alpha,
        }
    }

    /// Default for 433 MHz OOK at ~250 ksps.
    pub fn default_433() -> Self {
        Self::new(8, 3.0, 0.0005)
    }

    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<u8>) {
        let window_len = self.smooth_buf.len();
        for &sample in input {
            let mag = sample.norm();

            // Moving average smoothing
            self.smooth_sum -= self.smooth_buf[self.smooth_idx];
            self.smooth_buf[self.smooth_idx] = mag;
            self.smooth_sum += mag;
            self.smooth_idx = (self.smooth_idx + 1) % window_len;
            let smoothed = self.smooth_sum / window_len as f32;

            // Adaptive threshold
            let threshold = self.noise_floor * self.threshold_factor;
            if smoothed < threshold {
                // Update noise floor only when signal is low
                self.noise_floor += self.noise_alpha * (smoothed - self.noise_floor);
            }

            out.push(if smoothed > threshold { 1 } else { 0 });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn creates_default() {
        let _d = OokEnvelope::default_433();
    }

    #[test]
    fn silence_gives_zeros() {
        let mut det = OokEnvelope::new(4, 3.0, 0.001);
        let input = vec![Complex32::new(0.0, 0.0); 100];
        let mut out = Vec::new();
        det.process(&input, &mut out);
        assert_eq!(out.len(), 100);
        assert!(out.iter().all(|&b| b == 0));
    }

    #[test]
    fn strong_signal_gives_ones() {
        let mut det = OokEnvelope::new(4, 3.0, 0.001);
        // First let noise floor settle with silence
        let silence = vec![Complex32::new(0.001, 0.0); 200];
        let mut out = Vec::new();
        det.process(&silence, &mut out);
        out.clear();

        // Now strong signal
        let signal: Vec<Complex32> = (0..100)
            .map(|i| Complex32::from_polar(1.0, 2.0 * PI * 0.1 * i as f32))
            .collect();
        det.process(&signal, &mut out);
        // Most should be 1 (after a brief ramp-up)
        let ones = out.iter().filter(|&&b| b == 1).count();
        assert!(ones > 80, "expected mostly 1s for strong signal, got {ones}/100");
    }

    #[test]
    fn output_length_matches() {
        let mut det = OokEnvelope::default_433();
        let input = vec![Complex32::new(0.5, 0.5); 50];
        let mut out = Vec::new();
        det.process(&input, &mut out);
        assert_eq!(out.len(), 50);
    }
}
