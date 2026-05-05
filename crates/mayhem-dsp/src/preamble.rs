//! 1090ES preamble detector. At 2 Msps the preamble spans 16 samples (8 µs),
//! with 4 pulses at positions 0, 2, 7, 9 and quiet elsewhere.

/// Check whether a preamble starts at offset `i` in the magnitude-squared buffer.
/// Returns Some(strength) when detected; None otherwise.
pub fn detect(mag: &[f32], i: usize) -> Option<f32> {
    if i + 16 > mag.len() {
        return None;
    }
    let p = &mag[i..i + 16];
    // Each pulse must be the local max in its neighborhood.
    let high = [p[0], p[2], p[7], p[9]];
    let low = [p[1], p[3], p[4], p[5], p[6], p[8], p[10], p[11], p[12], p[13], p[14], p[15]];
    let high_min = high.iter().cloned().fold(f32::INFINITY, f32::min);
    let low_max = low.iter().cloned().fold(0.0f32, f32::max);
    if high_min < low_max * 2.0 {
        return None;
    }
    // Mean pulse magnitude is the "strength" useful for ranking simultaneous detections.
    let strength = high.iter().sum::<f32>() / 4.0;
    Some(strength)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthesize a clean preamble pattern at a known offset and ensure detection fires.
    #[test]
    fn detects_synthetic_preamble() {
        let mut mag = vec![0.01f32; 64];
        let pulse = 1.0f32;
        let offset = 16;
        for &i in &[0, 2, 7, 9] {
            mag[offset + i] = pulse;
        }
        let s = detect(&mag, offset).expect("expected preamble at offset");
        assert!((s - pulse).abs() < 1e-5);
    }

    #[test]
    fn rejects_uniform_noise() {
        let mag = vec![0.5f32; 64];
        assert!(detect(&mag, 16).is_none());
    }

    #[test]
    fn rejects_offset_too_close_to_end() {
        let mag = vec![0.0f32; 16];
        assert!(detect(&mag, 1).is_none()); // not enough samples for full preamble
    }
}
