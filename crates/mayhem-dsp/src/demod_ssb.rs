//! SSB demodulator using frequency-shifting (Weaver/third method).
//! Input: Complex32 baseband IQ (after decimation).
//! Output: f32 audio samples.
//!
//! USB (upper sideband): shift passband down by BFO offset, take real part.
//! LSB (lower sideband): shift passband up by BFO offset, take real part.

use num_complex::Complex32;
use std::f32::consts::PI;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sideband {
    Upper,
    Lower,
}

pub struct SsbDemod {
    phase: f32,
    phase_inc: f32,
    /// Single-pole LPF for bandwidth limiting
    lpf_alpha: f32,
    lpf_state: f32,
}

impl SsbDemod {
    /// Create SSB demodulator.
    /// - `sideband`: Upper or Lower.
    /// - `bfo_hz`: BFO offset frequency (typically ~1500 Hz for voice center).
    /// - `bandwidth_hz`: audio bandwidth (typically 2700 Hz).
    /// - `sample_rate`: input sample rate after decimation.
    pub fn new(sideband: Sideband, bfo_hz: f32, bandwidth_hz: f32, sample_rate: f32) -> Self {
        let sign = match sideband {
            Sideband::Upper => -1.0,  // shift down to demodulate upper sideband
            Sideband::Lower => 1.0,   // shift up to demodulate lower sideband
        };
        let phase_inc = 2.0 * PI * sign * bfo_hz / sample_rate;
        let fc = bandwidth_hz / 2.0;
        let lpf_alpha = 1.0 - (-2.0 * PI * fc / sample_rate).exp();

        Self {
            phase: 0.0,
            phase_inc,
            lpf_alpha,
            lpf_state: 0.0,
        }
    }

    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<f32>) {
        for &sample in input {
            // Mix with BFO oscillator
            let osc = Complex32::new(self.phase.cos(), self.phase.sin());
            let mixed = sample * osc;

            self.phase += self.phase_inc;
            if self.phase > PI { self.phase -= 2.0 * PI; }
            if self.phase < -PI { self.phase += 2.0 * PI; }

            // LPF on real part (audio extraction)
            self.lpf_state += self.lpf_alpha * (mixed.re - self.lpf_state);

            out.push(self.lpf_state);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usb_demod_tone_above_carrier() {
        // A tone at +1500 Hz from carrier (USB signal)
        // USB demod with BFO=1500 should shift it to ~0 Hz (DC) after LPF
        let sr = 48000.0;
        let tone_offset = 1500.0;
        let mut demod = SsbDemod::new(Sideband::Upper, 1500.0, 3000.0, sr);

        let input: Vec<Complex32> = (0..4800)
            .map(|i| {
                let t = i as f32 / sr;
                Complex32::from_polar(1.0, 2.0 * PI * tone_offset * t)
            })
            .collect();

        let mut out = Vec::new();
        demod.process(&input, &mut out);
        assert_eq!(out.len(), 4800);

        // After settling, output should be roughly constant (tone shifted to DC)
        let tail = &out[2000..];
        let mean: f32 = tail.iter().sum::<f32>() / tail.len() as f32;
        let variance: f32 = tail.iter().map(|x| (x - mean).powi(2)).sum::<f32>() / tail.len() as f32;
        // Low variance = constant = successfully demodulated to DC
        assert!(variance < 0.01, "expected low variance (tone at DC), got {variance}");
    }

    #[test]
    fn lsb_demod_creates() {
        let _demod = SsbDemod::new(Sideband::Lower, 1500.0, 2700.0, 48000.0);
    }

    #[test]
    fn output_length_matches_input() {
        let mut demod = SsbDemod::new(Sideband::Upper, 1500.0, 2700.0, 48000.0);
        let input = vec![Complex32::new(1.0, 0.0); 100];
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        assert_eq!(out.len(), 100);
    }
}
