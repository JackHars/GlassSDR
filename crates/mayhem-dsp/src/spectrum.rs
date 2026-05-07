//! FFT-based spectrum utilities for waterfall display.
//! Produces u8 log-magnitude bins suitable for direct rendering.

use num_complex::Complex32;

/// Pre-compute a Hann window of length `n`.
pub fn hann_window(n: usize) -> Vec<f32> {
    (0..n)
        .map(|i| {
            let w = (std::f32::consts::PI * i as f32 / n as f32).sin();
            w * w
        })
        .collect()
}

/// Apply a window function in-place to complex samples.
pub fn apply_window(samples: &mut [Complex32], window: &[f32]) {
    for (s, w) in samples.iter_mut().zip(window.iter()) {
        s.re *= w;
        s.im *= w;
    }
}

/// Compute log-magnitude in dB, mapped to 0..=255.
///
/// Uses a configurable dB range for better dynamic range utilization.
/// Typical values: `db_min = -80.0`, `db_max = -10.0` (matching GNU Radio defaults).
///
/// `fft_out` is the FFT output (frequency domain).
/// `out` is filled with `fft_out.len()` bytes.
pub fn log_magnitude_u8(fft_out: &[Complex32], out: &mut [u8]) {
    log_magnitude_u8_range(fft_out, out, -80.0, -10.0);
}

/// Compute log-magnitude with explicit dB range.
pub fn log_magnitude_u8_range(fft_out: &[Complex32], out: &mut [u8], db_min: f32, db_max: f32) {
    assert_eq!(fft_out.len(), out.len());
    let n = fft_out.len() as f32;
    let db_range = db_max - db_min;
    let scale = 255.0 / db_range;

    for (i, c) in fft_out.iter().enumerate() {
        // Normalized magnitude squared (divide by N for proper scaling)
        let mag2 = c.norm_sqr() / (n * n);
        let db = 10.0 * mag2.max(1e-30).log10();
        let v = ((db - db_min) * scale).clamp(0.0, 255.0);
        out[i] = v as u8;
    }
}

/// Apply FFT shift in place (swap halves) so DC is centered.
pub fn fft_shift_u8(buf: &mut [u8]) {
    let half = buf.len() / 2;
    let (a, b) = buf.split_at_mut(half);
    a.swap_with_slice(b);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dc_only_fft_maxes_zero_bin() {
        let n = 8;
        let mut fft = vec![Complex32::new(0.0, 0.0); n];
        fft[0] = Complex32::new(n as f32, 0.0);
        let mut out = vec![0u8; n];
        log_magnitude_u8(&fft, &mut out);
        // bin 0 magnitude = N / N = 1 → 0 dB → should be near max
        assert!(out[0] > 200);
    }

    #[test]
    fn fft_shift_swaps_halves() {
        let mut buf = vec![0, 1, 2, 3, 4, 5, 6, 7u8];
        fft_shift_u8(&mut buf);
        assert_eq!(buf, vec![4, 5, 6, 7, 0, 1, 2, 3]);
    }

    #[test]
    fn log_magnitude_silence_is_zero() {
        let n = 8;
        let fft = vec![Complex32::new(0.0, 0.0); n];
        let mut out = vec![255u8; n];
        log_magnitude_u8(&fft, &mut out);
        for v in &out {
            assert_eq!(*v, 0);
        }
    }

    #[test]
    fn hann_window_endpoints_zero() {
        let w = hann_window(64);
        assert!(w[0] < 0.001);
        assert!(w[63] < 0.001);
        // Peak at center
        assert!(w[32] > 0.99);
    }
}
