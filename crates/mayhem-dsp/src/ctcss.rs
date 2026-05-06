//! CTCSS sub-audible tone detector using Goertzel.
use std::f32::consts::PI;

pub const CTCSS_TONES: [f32; 38] = [
    67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
    97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
    136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
    192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3,
];

/// Detect CTCSS tone from audio samples. Returns detected frequency or None.
pub fn detect_ctcss(audio: &[f32], sample_rate: f32) -> Option<f32> {
    let block_size = (sample_rate * 0.4).min(audio.len() as f32) as usize;
    if block_size < 100 { return None; }
    let mut best_freq = 0.0f32;
    let mut best_power = 0.0f32;
    for &freq in &CTCSS_TONES {
        let power = goertzel(audio, freq, sample_rate, block_size);
        if power > best_power { best_power = power; best_freq = freq; }
    }
    let noise = goertzel(audio, 50.0, sample_rate, block_size);
    if best_power > noise * 10.0 { Some(best_freq) } else { None }
}

fn goertzel(samples: &[f32], freq: f32, sample_rate: f32, n: usize) -> f32 {
    let k = (freq * n as f32 / sample_rate).round();
    let coeff = 2.0 * (2.0 * PI * k / n as f32).cos();
    let (mut s1, mut s2) = (0.0f32, 0.0f32);
    for &s in samples.iter().take(n) { let s0 = s + coeff * s1 - s2; s2 = s1; s1 = s0; }
    s1 * s1 + s2 * s2 - coeff * s1 * s2
}
