//! Signal generator: produces IQ sample buffers for test waveforms.

use num_complex::Complex32;
use std::f32::consts::PI;

#[derive(Debug, Clone)]
pub enum Waveform {
    Cw { offset_hz: f32 },
    TwoTone { offset1_hz: f32, offset2_hz: f32 },
    Sweep { start_hz: f32, stop_hz: f32, sweep_time_s: f32 },
    Noise,
}

/// Generate IQ samples. `phase` is carried across calls for continuity.
pub fn generate(waveform: &Waveform, sample_rate: f32, num_samples: usize, phase: &mut f32) -> Vec<Complex32> {
    match waveform {
        Waveform::Cw { offset_hz } => {
            let inc = 2.0 * PI * offset_hz / sample_rate;
            (0..num_samples).map(|_| {
                let s = Complex32::new(phase.cos(), phase.sin());
                *phase += inc;
                if *phase > PI { *phase -= 2.0 * PI; }
                s
            }).collect()
        }
        Waveform::TwoTone { offset1_hz, offset2_hz } => {
            let inc1 = 2.0 * PI * offset1_hz / sample_rate;
            let inc2 = 2.0 * PI * offset2_hz / sample_rate;
            let mut phase2 = *phase;
            let result: Vec<_> = (0..num_samples).map(|_| {
                let s1 = Complex32::new(phase.cos(), phase.sin());
                let s2 = Complex32::new(phase2.cos(), phase2.sin());
                *phase += inc1;
                phase2 += inc2;
                if *phase > PI { *phase -= 2.0 * PI; }
                (s1 + s2) * 0.5
            }).collect();
            result
        }
        Waveform::Sweep { start_hz, stop_hz, sweep_time_s } => {
            let sweep_samples = (sweep_time_s * sample_rate) as usize;
            (0..num_samples).map(|i| {
                let t = (i % sweep_samples.max(1)) as f32 / sweep_samples.max(1) as f32;
                let freq = start_hz + (stop_hz - start_hz) * t;
                let inc = 2.0 * PI * freq / sample_rate;
                let s = Complex32::new(phase.cos(), phase.sin());
                *phase += inc;
                if *phase > PI { *phase -= 2.0 * PI; }
                s
            }).collect()
        }
        Waveform::Noise => {
            let mut seed = (*phase * 1000.0) as u64;
            let result: Vec<_> = (0..num_samples).map(|_| {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                let angle = (seed as f32 / u64::MAX as f32) * 2.0 * PI;
                Complex32::new(angle.cos(), angle.sin()) * 0.7
            }).collect();
            *phase += num_samples as f32;
            result
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cw_length() {
        let mut p = 0.0;
        let out = generate(&Waveform::Cw { offset_hz: 1000.0 }, 48000.0, 100, &mut p);
        assert_eq!(out.len(), 100);
    }

    #[test]
    fn cw_unit_magnitude() {
        let mut p = 0.0;
        let out = generate(&Waveform::Cw { offset_hz: 1000.0 }, 48000.0, 100, &mut p);
        for s in &out { assert!((s.norm() - 1.0).abs() < 0.01); }
    }

    #[test]
    fn noise_length() {
        let mut p = 0.0;
        let out = generate(&Waveform::Noise, 48000.0, 500, &mut p);
        assert_eq!(out.len(), 500);
    }

    #[test]
    fn sweep_length() {
        let mut p = 0.0;
        let out = generate(&Waveform::Sweep { start_hz: -10000.0, stop_hz: 10000.0, sweep_time_s: 1.0 }, 240000.0, 1000, &mut p);
        assert_eq!(out.len(), 1000);
    }
}
