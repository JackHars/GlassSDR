//! AFSK demodulator using Goertzel algorithm for mark/space energy comparison.
//! Input: f32 audio samples (after FM demod).
//! Output: u8 symbols (0 or 1) at the configured baud rate.
//! Default: Bell 202 (mark=1200 Hz, space=2200 Hz, baud=1200).

use std::f32::consts::PI;

pub struct AfskDemod {
    mark_coeff: f32,
    space_coeff: f32,
    samples_per_symbol: usize,
    // Goertzel state
    mark_s1: f32,
    mark_s2: f32,
    space_s1: f32,
    space_s2: f32,
    sample_count: usize,
}

impl AfskDemod {
    pub fn new(mark_hz: f32, space_hz: f32, baud_rate: f32, sample_rate: f32) -> Self {
        let sps = (sample_rate / baud_rate).round() as usize;
        let mark_k = mark_hz * sps as f32 / sample_rate;
        let space_k = space_hz * sps as f32 / sample_rate;
        Self {
            mark_coeff: 2.0 * (2.0 * PI * mark_k / sps as f32).cos(),
            space_coeff: 2.0 * (2.0 * PI * space_k / sps as f32).cos(),
            samples_per_symbol: sps,
            mark_s1: 0.0, mark_s2: 0.0,
            space_s1: 0.0, space_s2: 0.0,
            sample_count: 0,
        }
    }

    /// Bell 202: 1200 Hz mark, 2200 Hz space, 1200 baud.
    pub fn bell_202(sample_rate: f32) -> Self {
        Self::new(1200.0, 2200.0, 1200.0, sample_rate)
    }

    pub fn process(&mut self, input: &[f32], out: &mut Vec<u8>) {
        for &sample in input {
            // Feed Goertzel filters
            let ms0 = sample + self.mark_coeff * self.mark_s1 - self.mark_s2;
            self.mark_s2 = self.mark_s1;
            self.mark_s1 = ms0;

            let ss0 = sample + self.space_coeff * self.space_s1 - self.space_s2;
            self.space_s2 = self.space_s1;
            self.space_s1 = ss0;

            self.sample_count += 1;

            if self.sample_count >= self.samples_per_symbol {
                let mark_power = self.mark_s1 * self.mark_s1 + self.mark_s2 * self.mark_s2
                    - self.mark_coeff * self.mark_s1 * self.mark_s2;
                let space_power = self.space_s1 * self.space_s1 + self.space_s2 * self.space_s2
                    - self.space_coeff * self.space_s1 * self.space_s2;

                out.push(if mark_power > space_power { 1 } else { 0 });

                // Reset
                self.mark_s1 = 0.0; self.mark_s2 = 0.0;
                self.space_s1 = 0.0; self.space_s2 = 0.0;
                self.sample_count = 0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bell_202_creates() {
        let _d = AfskDemod::bell_202(22050.0);
    }

    #[test]
    fn mark_tone_gives_ones() {
        let sr = 22050.0;
        let mut demod = AfskDemod::bell_202(sr);
        // Generate pure 1200 Hz tone (mark)
        let n = (sr / 1200.0).round() as usize * 10; // 10 symbol periods
        let input: Vec<f32> = (0..n)
            .map(|i| (2.0 * PI * 1200.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        assert!(!out.is_empty());
        // Most symbols should be 1 (mark)
        let ones: usize = out.iter().filter(|&&b| b == 1).count();
        assert!(ones > out.len() / 2, "mark tone should produce mostly 1s, got {ones}/{}", out.len());
    }

    #[test]
    fn space_tone_gives_zeros() {
        let sr = 22050.0;
        let mut demod = AfskDemod::bell_202(sr);
        // Generate pure 2200 Hz tone (space)
        let n = (sr / 1200.0).round() as usize * 10;
        let input: Vec<f32> = (0..n)
            .map(|i| (2.0 * PI * 2200.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        demod.process(&input, &mut out);
        assert!(!out.is_empty());
        let zeros: usize = out.iter().filter(|&&b| b == 0).count();
        assert!(zeros > out.len() / 2, "space tone should produce mostly 0s, got {zeros}/{}", out.len());
    }
}
