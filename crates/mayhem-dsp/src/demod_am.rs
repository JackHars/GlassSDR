//! AM envelope detector: |I + jQ| with DC-blocking filter and simple AGC.
//! Input: Complex32 baseband IQ (after decimation).
//! Output: f32 audio samples.

use num_complex::Complex32;

pub struct AmDemod {
    dc_alpha: f32,
    dc_avg: f32,
    agc_target: f32,
    agc_gain: f32,
    agc_attack: f32,
    agc_decay: f32,
}

impl AmDemod {
    /// Create AM demodulator.
    /// - `agc_target`: desired output amplitude (e.g., 0.5).
    pub fn new(agc_target: f32) -> Self {
        Self {
            dc_alpha: 0.995,
            dc_avg: 0.0,
            agc_target,
            agc_gain: 1.0,
            agc_attack: 0.01,
            agc_decay: 0.001,
        }
    }

    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<f32>) {
        for &sample in input {
            // Envelope detection
            let mag = sample.norm();

            // DC blocking (high-pass IIR)
            self.dc_avg = self.dc_alpha * self.dc_avg + (1.0 - self.dc_alpha) * mag;
            let audio = mag - self.dc_avg;

            // AGC
            let abs_val = audio.abs();
            if abs_val > self.agc_target {
                self.agc_gain -= self.agc_attack * (abs_val - self.agc_target);
            } else {
                self.agc_gain += self.agc_decay * (self.agc_target - abs_val);
            }
            self.agc_gain = self.agc_gain.clamp(0.001, 100.0);

            out.push(audio * self.agc_gain);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn demod_constant_carrier_gives_near_zero() {
        // Constant-amplitude carrier → envelope is constant → DC block removes it → ~0
        let mut demod = AmDemod::new(0.5);
        let input: Vec<Complex32> = (0..1000)
            .map(|i| Complex32::from_polar(1.0, 2.0 * PI * 0.1 * i as f32))
            .collect();
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        // After DC block settles, output should be near zero
        let tail_avg: f32 = out[500..].iter().map(|x| x.abs()).sum::<f32>() / 500.0;
        assert!(tail_avg < 0.1, "expected near-zero for constant carrier, got {tail_avg}");
    }

    #[test]
    fn demod_am_modulated_recovers_envelope() {
        // AM signal: carrier modulated by a slow sine (audio)
        let mut demod = AmDemod::new(0.5);
        let sr = 48000.0f32;
        let audio_freq = 1000.0;
        let input: Vec<Complex32> = (0..4800)
            .map(|i| {
                let t = i as f32 / sr;
                let envelope = 1.0 + 0.5 * (2.0 * PI * audio_freq * t).sin();
                Complex32::from_polar(envelope, 2.0 * PI * 10000.0 * t)
            })
            .collect();
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        assert_eq!(out.len(), 4800);
        // Output should have oscillation at audio_freq (not be flat)
        let variance: f32 = out[1000..].iter().map(|x| x * x).sum::<f32>() / 3800.0;
        assert!(variance > 0.001, "expected modulated output, got variance {variance}");
    }
}
