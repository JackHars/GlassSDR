//! FFT-based spectrum block. Produces SpectrumFrame-like payloads:
//! u8 log-magnitude bins, suitable for direct rendering as a 1px-tall waterfall row.

use num_complex::Complex32;

/// Compute log-magnitude in dB, normalized to 0..=255 with -100 dB → 0, 0 dB → 255.
/// fft must be power-of-two length, in time-domain order before transform.
/// `out` is filled with `fft.len()` bytes.
pub fn log_magnitude_u8(fft_out: &[Complex32], out: &mut [u8]) {
    assert_eq!(fft_out.len(), out.len());
    let n = fft_out.len() as f32;
    for (i, c) in fft_out.iter().enumerate() {
        let mag2 = c.norm_sqr() / (n * n);
        let db = 10.0 * mag2.max(1e-30).log10();
        // map [-100 dB, 0 dB] -> [0, 255]
        let v = ((db + 100.0) * 2.55).clamp(0.0, 255.0);
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
    use approx::assert_relative_eq;

    #[test]
    fn dc_only_fft_maxes_zero_bin() {
        // Time-domain DC of amplitude 1 yields FFT[0] = N, others = 0.
        let n = 8;
        let mut fft = vec![Complex32::new(0.0, 0.0); n];
        fft[0] = Complex32::new(n as f32, 0.0);
        let mut out = vec![0u8; n];
        log_magnitude_u8(&fft, &mut out);
        // bin 0 magnitude = N / N = 1 → 0 dB → 255
        assert_eq!(out[0], 255);
        for v in &out[1..] {
            assert_eq!(*v, 0);
        }
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
            assert_relative_eq!(*v as f32, 0.0);
        }
    }
}
