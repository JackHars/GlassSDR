//! SSTV encoder: image → frequency sequence (Robot36 mode).

#[derive(Debug, Clone, Copy)]
pub enum SstvMode {
    Robot36,
}

const FREQ_BLACK: f32 = 1500.0;
const FREQ_WHITE: f32 = 2300.0;
const FREQ_SYNC: f32 = 1200.0;

/// Encode a grayscale image (width × height, row-major, 0–255) to a frequency sequence
/// suitable for FM-modulated SSTV transmission (Robot36 mode).
pub fn encode_sstv_robot36(pixels: &[u8], width: u32, height: u32, sample_rate: f32) -> Vec<f32> {
    let mut freqs = Vec::new();

    // Leader tone 300 ms @ 1900 Hz
    append_tone(&mut freqs, 1900.0, 0.3, sample_rate);

    // VIS code for Robot36 = 8
    append_tone(&mut freqs, FREQ_SYNC, 0.03, sample_rate); // start bit
    for i in 0..8 {
        let bit = (8u8 >> i) & 1;
        append_tone(
            &mut freqs,
            if bit == 1 { 1100.0 } else { 1300.0 },
            0.03,
            sample_rate,
        );
    }
    append_tone(&mut freqs, FREQ_SYNC, 0.03, sample_rate); // stop bit

    // Image lines
    for row in 0..height.min(240) {
        append_tone(&mut freqs, FREQ_SYNC, 0.009, sample_rate); // sync pulse
        for col in 0..width.min(320) {
            let idx = (row * width + col) as usize;
            let lum = if idx < pixels.len() {
                pixels[idx] as f32 / 255.0
            } else {
                0.0
            };
            let freq = FREQ_BLACK + lum * (FREQ_WHITE - FREQ_BLACK);
            freqs.push(freq);
        }
    }

    freqs
}

fn append_tone(freqs: &mut Vec<f32>, freq: f32, duration_s: f32, sample_rate: f32) {
    let n = (duration_s * sample_rate).round() as usize;
    freqs.extend(std::iter::repeat(freq).take(n));
}
