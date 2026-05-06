use std::f32::consts::PI;

pub struct StereoDecoder {
    sample_rate: f32,
    // PLL for 19 kHz pilot
    pilot_phase: f32,
    pilot_freq: f32,    // radians per sample (tracks near 19 kHz)
    pll_alpha: f32,
    pll_beta: f32,
    // LPF for mono (L+R): 3-stage cascaded IIR at 15 kHz
    lpf_mono: [f32; 3],
    // LPF for difference (L-R): 3-stage cascaded IIR at 15 kHz
    lpf_diff: [f32; 3],
    lpf_alpha: f32,
}

impl StereoDecoder {
    pub fn new(sample_rate: f32) -> Self {
        // PLL bandwidth ~5 Hz for narrow pilot lock
        let bw = 5.0;
        let damping = 0.707;
        let wn = 2.0 * PI * bw / sample_rate;
        let pll_alpha = 2.0 * damping * wn;
        let pll_beta = wn * wn;

        // Audio LPF at 15 kHz
        let lpf_alpha = 1.0 - (-2.0 * PI * 15000.0 / sample_rate).exp();

        let pilot_freq = 2.0 * PI * 19000.0 / sample_rate;

        Self {
            sample_rate,
            pilot_phase: 0.0,
            pilot_freq,
            pll_alpha,
            pll_beta,
            lpf_mono: [0.0; 3],
            lpf_diff: [0.0; 3],
            lpf_alpha,
        }
    }

    /// Process composite FM-demodulated signal.
    /// Output is interleaved stereo [L, R, L, R, ...], length = 2 × input.len().
    pub fn process(&mut self, input: &[f32], out: &mut Vec<f32>) {
        for &sample in input {
            // PLL: use quadrature (cosine) reference as phase detector.
            // When locked to the 19 kHz pilot: sample ≈ A·sin(pilot_phase + err)
            // detector = sample · cos(pilot_phase) ≈ (A/2)·sin(err) ≈ (A/2)·err
            let pilot_cos = self.pilot_phase.cos();
            let error = sample * pilot_cos;

            // Loop filter
            self.pilot_freq += self.pll_beta * error;
            // Clamp VCO frequency to ±500 Hz around 19 kHz to prevent drift
            let nominal = 2.0 * PI * 19000.0 / self.sample_rate;
            let guard = 2.0 * PI * 500.0 / self.sample_rate;
            if self.pilot_freq > nominal + guard { self.pilot_freq = nominal + guard; }
            if self.pilot_freq < nominal - guard { self.pilot_freq = nominal - guard; }
            self.pilot_phase += self.pilot_freq + self.pll_alpha * error;

            // Wrap phase
            if self.pilot_phase > PI { self.pilot_phase -= 2.0 * PI; }
            if self.pilot_phase < -PI { self.pilot_phase += 2.0 * PI; }

            // 38 kHz reference from doubled pilot phase
            let ref_38k = (2.0 * self.pilot_phase).sin();

            // Extract mono (L+R): 3-stage cascaded IIR LPF at 15 kHz
            let a = self.lpf_alpha;
            self.lpf_mono[0] += a * (sample - self.lpf_mono[0]);
            self.lpf_mono[1] += a * (self.lpf_mono[0] - self.lpf_mono[1]);
            self.lpf_mono[2] += a * (self.lpf_mono[1] - self.lpf_mono[2]);

            // Extract stereo difference (L-R): multiply by 38 kHz, then 3-stage LPF
            let diff_raw = sample * ref_38k * 2.0;
            self.lpf_diff[0] += a * (diff_raw - self.lpf_diff[0]);
            self.lpf_diff[1] += a * (self.lpf_diff[0] - self.lpf_diff[1]);
            self.lpf_diff[2] += a * (self.lpf_diff[1] - self.lpf_diff[2]);

            // Matrix
            let left = self.lpf_mono[2] + self.lpf_diff[2];
            let right = self.lpf_mono[2] - self.lpf_diff[2];

            out.push(left);
            out.push(right);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_is_double_input_length() {
        let mut dec = StereoDecoder::new(240000.0);
        let input = vec![0.0f32; 100];
        let mut out = Vec::new();
        dec.process(&input, &mut out);
        assert_eq!(out.len(), 200);
    }

    #[test]
    fn mono_signal_same_in_both_channels() {
        // Pure mono signal (no 19 kHz pilot, no 38 kHz subcarrier)
        // → L and R should be approximately equal
        let sr = 240000.0;
        let mut dec = StereoDecoder::new(sr);
        // 1 kHz mono tone
        let input: Vec<f32> = (0..24000)
            .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin() * 0.5)
            .collect();
        let mut out = Vec::new();
        dec.process(&input, &mut out);

        // Check L≈R in the tail (after PLL settles)
        let tail_start = 20000; // sample pairs
        let mut diff_sum = 0.0f32;
        for i in (tail_start..out.len()).step_by(2) {
            if i + 1 < out.len() {
                diff_sum += (out[i] - out[i + 1]).abs();
            }
        }
        let avg_diff = diff_sum / ((out.len() - tail_start) / 2) as f32;
        assert!(avg_diff < 0.1, "mono signal should give L≈R, avg diff={avg_diff}");
    }

    #[test]
    fn creates_at_various_rates() {
        let _d1 = StereoDecoder::new(192000.0);
        let _d2 = StereoDecoder::new(240000.0);
        let _d3 = StereoDecoder::new(384000.0);
    }
}
