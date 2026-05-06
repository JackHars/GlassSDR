//! Manchester and pulse-width decoder.
//! Input: f32 samples (envelope signal, thresholded to high/low transitions).
//! Output: u8 decoded bits.
//!
//! Modes:
//! - PulseWidth: short pulse = 0, long pulse = 1 (common for OOK sensors)
//! - Manchester IEEE: mid-bit H→L = 1, L→H = 0

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManchesterMode {
    /// Pulse-width: short high < threshold = 0, long high > threshold = 1
    PulseWidth,
    /// IEEE 802.3 Manchester
    Manchester,
}

pub struct ManchesterDecoder {
    mode: ManchesterMode,
    samples_per_bit: usize,
    threshold: f32,
    last_level: bool,
    run_length: usize,
}

impl ManchesterDecoder {
    pub fn new(mode: ManchesterMode, bit_rate: f32, sample_rate: f32, threshold: f32) -> Self {
        Self {
            mode,
            samples_per_bit: (sample_rate / bit_rate).round() as usize,
            threshold,
            last_level: false,
            run_length: 0,
        }
    }

    pub fn process(&mut self, input: &[f32], out: &mut Vec<u8>) {
        for &sample in input {
            let level = sample > self.threshold;

            if level == self.last_level {
                self.run_length += 1;
            } else {
                // Transition detected — decode based on mode
                match self.mode {
                    ManchesterMode::PulseWidth => {
                        if self.last_level {
                            // Was high — pulse ended. Classify duration.
                            let half = self.samples_per_bit / 2;
                            if self.run_length > half {
                                out.push(1); // long pulse
                            } else if self.run_length > half / 4 {
                                out.push(0); // short pulse
                            }
                            // Very short = glitch, ignore
                        }
                    }
                    ManchesterMode::Manchester => {
                        // In Manchester, a transition at mid-bit carries data.
                        // H→L at mid-bit = 1, L→H at mid-bit = 0.
                        // Transitions at bit boundaries are clock edges (ignore).
                        //
                        // A run of ~half = mid-bit data transition.
                        // A run of ~full (samples_per_bit) = bit-boundary clock edge followed
                        // immediately by the opposite half of the same bit, meaning the *next*
                        // transition will be a mid-bit data transition for the upcoming bit.
                        // We emit the implied bit now: the polarity reversal at a full-period
                        // boundary means the new half started with `level` (the incoming
                        // state), so the mid-bit transition (when it comes) will carry `level`.
                        // Simpler: treat a full-period run as a boundary edge and emit the bit
                        // implied by the *incoming* level (L→H boundary ⇒ bit 0 started L,
                        // mid-bit will be L→H ⇒ 0; H→L boundary ⇒ bit 1 started H, mid-bit
                        // will be H→L ⇒ 1).
                        let half = self.samples_per_bit / 2;
                        let is_mid_bit = self.run_length > half / 2
                            && self.run_length < half * 3 / 2;
                        let is_boundary = self.run_length >= half * 3 / 2
                            && self.run_length < half * 5 / 2;
                        if is_mid_bit {
                            // H→L = 1, L→H = 0
                            out.push(if self.last_level { 1 } else { 0 });
                        } else if is_boundary {
                            // Full-period run: bit boundary + first half of next bit.
                            // The incoming `level` is the second-half of the next bit,
                            // so the bit that just ended has mid-bit in the incoming direction.
                            // Emit: level (incoming) means next half started as !level → mid-bit
                            // transition is !level→level ⇒ bit = !level (L→H=0, H→L=1).
                            out.push(if level { 0 } else { 1 });
                        }
                    }
                }
                self.last_level = level;
                self.run_length = 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pulse_width_short_long() {
        // sample_rate=1000, bit_rate=100 → 10 samples/bit. half=5.
        let mut dec = ManchesterDecoder::new(ManchesterMode::PulseWidth, 100.0, 1000.0, 0.5);
        // Short pulse (3 samples high) then gap, long pulse (8 samples high) then gap
        let mut input = Vec::new();
        input.extend(vec![1.0f32; 3]);  // short high
        input.extend(vec![0.0f32; 10]); // gap
        input.extend(vec![1.0f32; 8]);  // long high
        input.extend(vec![0.0f32; 10]); // gap

        let mut out = Vec::new();
        dec.process(&input, &mut out);
        assert_eq!(out, vec![0, 1]);
    }

    #[test]
    fn manchester_alternating() {
        let mut dec = ManchesterDecoder::new(ManchesterMode::Manchester, 1000.0, 10000.0, 0.5);
        // 10 samples/bit, half=5.
        // Manchester 1: high for 5 samples, low for 5 samples (H→L at mid-bit)
        // Manchester 0: low for 5, high for 5 (L→H at mid-bit)
        let mut input = Vec::new();
        // Bit 1: H→L
        input.extend(vec![1.0f32; 5]);
        input.extend(vec![0.0f32; 5]);
        // Bit 0: L→H
        input.extend(vec![0.0f32; 5]);
        input.extend(vec![1.0f32; 5]);

        let mut out = Vec::new();
        dec.process(&input, &mut out);
        // Should detect H→L = 1, then L→H = 0
        assert!(out.contains(&1));
        assert!(out.contains(&0));
    }

    #[test]
    fn creates_with_various_rates() {
        let _d = ManchesterDecoder::new(ManchesterMode::PulseWidth, 32768.0, 1_000_000.0, 0.3);
        let _d = ManchesterDecoder::new(ManchesterMode::Manchester, 1000.0, 48000.0, 0.5);
    }
}
