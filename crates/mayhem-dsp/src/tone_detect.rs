//! Multi-tone Goertzel detector.
//! Monitors a set of target frequencies, reports which are present above threshold.

use std::f32::consts::PI;

/// A detected tone.
#[derive(Debug, Clone, Copy)]
pub struct ToneDetection {
    pub freq_hz: f32,
    pub power_db: f32,
}

pub struct ToneDetector {
    targets: Vec<f32>,       // frequencies to monitor
    coefficients: Vec<f32>,  // Goertzel coefficients per frequency
    block_size: usize,       // samples per analysis window
    threshold_db: f32,       // min power to report
    // Per-frequency Goertzel state
    s1: Vec<f32>,
    s2: Vec<f32>,
    sample_count: usize,
}

impl ToneDetector {
    /// Create a tone detector.
    /// - `freqs`: target frequencies to monitor.
    /// - `sample_rate`: audio sample rate.
    /// - `block_size`: analysis window (larger = better freq resolution, slower response).
    /// - `threshold_db`: minimum power (dB relative to full-scale) to report.
    pub fn new(freqs: Vec<f32>, sample_rate: f32, block_size: usize, threshold_db: f32) -> Self {
        let coefficients: Vec<f32> = freqs.iter()
            .map(|&f| {
                let k = (f * block_size as f32 / sample_rate).round();
                2.0 * (2.0 * PI * k / block_size as f32).cos()
            })
            .collect();
        let n = freqs.len();
        Self {
            targets: freqs,
            coefficients,
            block_size,
            threshold_db,
            s1: vec![0.0; n],
            s2: vec![0.0; n],
            sample_count: 0,
        }
    }

    /// Process audio samples. Returns detected tones (those above threshold) per block.
    pub fn process(&mut self, input: &[f32], detections: &mut Vec<ToneDetection>) {
        for &sample in input {
            for i in 0..self.targets.len() {
                let s0 = sample + self.coefficients[i] * self.s1[i] - self.s2[i];
                self.s2[i] = self.s1[i];
                self.s1[i] = s0;
            }

            self.sample_count += 1;

            if self.sample_count >= self.block_size {
                // Compute power for each frequency
                for i in 0..self.targets.len() {
                    let power = self.s1[i] * self.s1[i] + self.s2[i] * self.s2[i]
                        - self.coefficients[i] * self.s1[i] * self.s2[i];
                    let power_db = 10.0 * (power / self.block_size as f32).max(1e-12).log10();

                    if power_db > self.threshold_db {
                        detections.push(ToneDetection {
                            freq_hz: self.targets[i],
                            power_db,
                        });
                    }
                }

                // Reset state
                self.s1.iter_mut().for_each(|v| *v = 0.0);
                self.s2.iter_mut().for_each(|v| *v = 0.0);
                self.sample_count = 0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_present_tone() {
        let sr = 8000.0;
        let mut det = ToneDetector::new(vec![1000.0, 2000.0], sr, 800, -30.0);
        // Generate 1000 Hz tone
        let input: Vec<f32> = (0..800)
            .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        det.process(&input, &mut out);
        // Should detect 1000 Hz above threshold
        assert!(!out.is_empty(), "should detect tone");
        assert!(out.iter().any(|d| (d.freq_hz - 1000.0).abs() < 1.0));
    }

    #[test]
    fn does_not_detect_absent_tone() {
        let sr = 8000.0;
        let mut det = ToneDetector::new(vec![1000.0, 2000.0], sr, 800, -30.0);
        // Generate 1000 Hz — should NOT detect 2000 Hz
        let input: Vec<f32> = (0..800)
            .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        det.process(&input, &mut out);
        // 2000 Hz should be below threshold (if detected at all, power should be very low)
        let det_2k: Vec<&ToneDetection> = out.iter().filter(|d| (d.freq_hz - 2000.0).abs() < 1.0).collect();
        // Either not detected or very low power
        for d in det_2k {
            assert!(d.power_db < -20.0, "2000 Hz should not be strong: {}", d.power_db);
        }
    }

    #[test]
    fn silence_gives_no_detections() {
        let mut det = ToneDetector::new(vec![500.0, 1000.0, 1500.0], 8000.0, 400, -40.0);
        let input = vec![0.0f32; 400];
        let mut out = Vec::new();
        det.process(&input, &mut out);
        assert!(out.is_empty(), "silence should give no detections");
    }

    #[test]
    fn multiple_blocks() {
        let sr = 8000.0;
        let mut det = ToneDetector::new(vec![1000.0], sr, 400, -30.0);
        // 2 blocks worth of 1000 Hz
        let input: Vec<f32> = (0..800)
            .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin())
            .collect();
        let mut out = Vec::new();
        det.process(&input, &mut out);
        assert_eq!(out.len(), 2, "should get 2 detections for 2 blocks");
    }
}
