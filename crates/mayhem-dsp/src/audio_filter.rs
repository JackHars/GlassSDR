//! Configurable audio bandpass filter using a biquad IIR.
//! Input/Output: f32 audio samples.
//! Used for mode-specific bandwidth limiting:
//!   CW: 400-800 Hz, SSB: 300-3000 Hz, AM: 100-5000 Hz, WFM: 50-15000 Hz.

use std::f32::consts::PI;

pub struct AudioBandpass {
    b0: f32, b1: f32, b2: f32,
    a1: f32, a2: f32,
    x1: f32, x2: f32,
    y1: f32, y2: f32,
}

impl AudioBandpass {
    /// Create a bandpass filter.
    /// - `low_hz`: lower -3dB cutoff.
    /// - `high_hz`: upper -3dB cutoff.
    /// - `sample_rate`: audio sample rate (e.g., 48000).
    pub fn new(low_hz: f32, high_hz: f32, sample_rate: f32) -> Self {
        let center = (low_hz * high_hz).sqrt();
        let bw = high_hz - low_hz;
        let q = center / bw;

        let w0 = 2.0 * PI * center / sample_rate;
        let alpha = w0.sin() / (2.0 * q);

        let b0 = alpha;
        let b1 = 0.0;
        let b2 = -alpha;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha;

        Self {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0,
            x1: 0.0, x2: 0.0, y1: 0.0, y2: 0.0,
        }
    }

    /// Preset for CW reception (400-800 Hz narrow).
    pub fn cw(sample_rate: f32) -> Self { Self::new(400.0, 800.0, sample_rate) }

    /// Preset for SSB voice (300-3000 Hz).
    pub fn ssb(sample_rate: f32) -> Self { Self::new(300.0, 3000.0, sample_rate) }

    /// Preset for AM broadcast (100-5000 Hz).
    pub fn am(sample_rate: f32) -> Self { Self::new(100.0, 5000.0, sample_rate) }

    pub fn process(&mut self, input: &[f32], out: &mut Vec<f32>) {
        for &x0 in input {
            let y0 = self.b0 * x0 + self.b1 * self.x1 + self.b2 * self.x2
                   - self.a1 * self.y1 - self.a2 * self.y2;
            self.x2 = self.x1;
            self.x1 = x0;
            self.y2 = self.y1;
            self.y1 = y0;
            out.push(y0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_length_matches() {
        let mut filt = AudioBandpass::ssb(48000.0);
        let input = vec![0.5f32; 100];
        let mut out = Vec::new();
        filt.process(&input, &mut out);
        assert_eq!(out.len(), 100);
    }

    #[test]
    fn passband_signal_passes() {
        // 1000 Hz tone through SSB filter (300-3000) should pass
        let sr = 48000.0;
        let mut filt = AudioBandpass::ssb(sr);
        let input: Vec<f32> = (0..4800)
            .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        filt.process(&input, &mut out);
        // Measure power in tail (after transient)
        let power: f32 = out[2000..].iter().map(|x| x * x).sum::<f32>() / 2800.0;
        assert!(power > 0.1, "passband signal should have significant power, got {power}");
    }

    #[test]
    fn stopband_signal_attenuated() {
        // 10000 Hz tone through SSB filter (300-3000) should be attenuated
        let sr = 48000.0;
        let mut filt = AudioBandpass::ssb(sr);
        let input: Vec<f32> = (0..4800)
            .map(|i| (2.0 * PI * 10000.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        filt.process(&input, &mut out);
        let power: f32 = out[2000..].iter().map(|x| x * x).sum::<f32>() / 2800.0;
        assert!(power < 0.05, "stopband signal should be attenuated, got {power}");
    }

    #[test]
    fn cw_narrow_filter_creates() {
        let _filt = AudioBandpass::cw(48000.0);
    }
}
