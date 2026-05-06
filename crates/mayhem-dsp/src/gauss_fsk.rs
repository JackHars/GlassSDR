//! Gaussian-filtered 2-FSK modulator.
//!
//! Converts a bitstream (bytes with values 0 or 1) into Complex IQ samples
//! suitable for transmission. Primarily intended for POCSAG TX at ±4500 Hz
//! deviation.

use num_complex::Complex32;
use std::f32::consts::PI;

pub struct GaussFsk {
    deviation_hz: f32,
    sample_rate: f32,
    samples_per_symbol: usize,
    /// Gaussian filter taps, length = span_symbols * samples_per_symbol.
    filter_taps: Vec<f32>,
    /// Ring buffer holding the NRZ-mapped input values for convolution.
    ring_buf: Vec<f32>,
    /// Write head for the ring buffer.
    ring_pos: usize,
    /// Accumulated carrier phase (radians).
    phase: f32,
}

impl GaussFsk {
    /// Create a new Gaussian FSK modulator.
    ///
    /// # Arguments
    /// * `deviation_hz`   – Peak frequency deviation in Hz (e.g. 4500.0 for POCSAG).
    /// * `symbol_rate`    – Symbol rate in symbols/second (e.g. 1200.0).
    /// * `sample_rate`    – Output sample rate in samples/second (e.g. 2_400_000.0).
    /// * `bt`             – Bandwidth–time product of the Gaussian filter (e.g. 0.5).
    /// * `span_symbols`   – Number of symbols the Gaussian filter spans (typically 3).
    pub fn new(
        deviation_hz: f32,
        symbol_rate: f32,
        sample_rate: f32,
        bt: f32,
        span_symbols: usize,
    ) -> Self {
        let samples_per_symbol = (sample_rate / symbol_rate).round() as usize;
        let filter_taps = gaussian_taps(bt, samples_per_symbol, span_symbols);
        let tap_len = filter_taps.len();
        Self {
            deviation_hz,
            sample_rate,
            samples_per_symbol,
            filter_taps,
            ring_buf: vec![0.0f32; tap_len],
            ring_pos: 0,
            phase: 0.0,
        }
    }

    /// Modulate symbols to IQ samples.
    ///
    /// Each element of `symbols` must be 0 or 1. The output length equals
    /// `symbols.len() * samples_per_symbol`.
    pub fn modulate(&mut self, symbols: &[u8]) -> Vec<Complex32> {
        let tap_len = self.filter_taps.len();
        let mut out = Vec::with_capacity(symbols.len() * self.samples_per_symbol);

        for &sym in symbols {
            // Map bit to NRZ: 0 → -1.0, 1 → +1.0
            let nrz = if sym == 0 { -1.0f32 } else { 1.0f32 };

            for _ in 0..self.samples_per_symbol {
                // Insert current NRZ value into ring buffer.
                self.ring_buf[self.ring_pos] = nrz;
                self.ring_pos = (self.ring_pos + 1) % tap_len;

                // Convolve ring buffer with Gaussian taps.
                // ring_pos now points to the oldest sample (read head).
                let mut filtered = 0.0f32;
                for (k, &tap) in self.filter_taps.iter().enumerate() {
                    let idx = (self.ring_pos + k) % tap_len;
                    filtered += self.ring_buf[idx] * tap;
                }

                // Advance phase.
                let phase_inc = 2.0 * PI * self.deviation_hz * filtered / self.sample_rate;
                self.phase += phase_inc;

                // Wrap phase to [-π, π].
                while self.phase > PI {
                    self.phase -= 2.0 * PI;
                }
                while self.phase < -PI {
                    self.phase += 2.0 * PI;
                }

                out.push(Complex32::new(self.phase.cos(), self.phase.sin()));
            }
        }

        out
    }
}

/// Build normalized Gaussian filter taps.
///
/// The filter has `span_symbols * samples_per_symbol` taps and is normalised
/// so that its sum equals 1.0.
fn gaussian_taps(bt: f32, samples_per_symbol: usize, span_symbols: usize) -> Vec<f32> {
    let n = span_symbols * samples_per_symbol;
    let sigma = (2.0 * PI * bt).recip() * (2.0f32.ln()).sqrt();
    let center = (n as f32 - 1.0) / 2.0;
    let mut taps: Vec<f32> = (0..n)
        .map(|i| {
            let t = (i as f32 - center) / samples_per_symbol as f32;
            (-0.5 * (t / sigma).powi(2)).exp()
        })
        .collect();
    let sum: f32 = taps.iter().sum();
    taps.iter_mut().for_each(|t| *t /= sum);
    taps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_length_correct() {
        let mut mod_ = GaussFsk::new(4500.0, 1200.0, 48000.0, 0.5, 3);
        let symbols = vec![1u8, 0, 1, 1, 0];
        let iq = mod_.modulate(&symbols);
        assert_eq!(iq.len(), 5 * 40); // 48000/1200 = 40 samples/symbol
    }

    #[test]
    fn output_unit_magnitude() {
        let mut mod_ = GaussFsk::new(4500.0, 1200.0, 48000.0, 0.5, 3);
        let symbols = vec![1u8; 100];
        let iq = mod_.modulate(&symbols);
        for s in &iq {
            let mag = s.norm();
            assert!((mag - 1.0).abs() < 0.01, "magnitude {mag} not ~1.0");
        }
    }

    #[test]
    fn gaussian_taps_sum_to_one() {
        let taps = gaussian_taps(0.5, 40, 3);
        let sum: f32 = taps.iter().sum();
        assert!((sum - 1.0).abs() < 1e-5);
    }

    #[test]
    fn gaussian_taps_symmetric() {
        let taps = gaussian_taps(0.5, 40, 3);
        let n = taps.len();
        for i in 0..n / 2 {
            assert!(
                (taps[i] - taps[n - 1 - i]).abs() < 1e-6,
                "taps[{i}]={} != taps[{}]={}",
                taps[i],
                n - 1 - i,
                taps[n - 1 - i]
            );
        }
    }
}
