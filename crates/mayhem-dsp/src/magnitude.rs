//! Squared magnitude of complex samples: |I|² + |Q|². No square root — keeps
//! relative thresholds correct without paying the sqrt cost per sample.

use num_complex::Complex32;

/// Compute |z|² into out (out.len() == input.len()).
pub fn magnitude_squared(input: &[Complex32], out: &mut [f32]) {
    debug_assert_eq!(input.len(), out.len());
    for (z, o) in input.iter().zip(out.iter_mut()) {
        *o = z.re * z.re + z.im * z.im;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn magnitude_squared_unit_circle() {
        let inp = vec![Complex32::new(1.0, 0.0), Complex32::new(0.0, 1.0), Complex32::new(0.6, 0.8)];
        let mut out = vec![0.0f32; 3];
        magnitude_squared(&inp, &mut out);
        assert_relative_eq!(out[0], 1.0);
        assert_relative_eq!(out[1], 1.0);
        assert_relative_eq!(out[2], 1.0, epsilon = 1e-5);
    }

    #[test]
    fn magnitude_squared_zero_input() {
        let inp = vec![Complex32::new(0.0, 0.0); 4];
        let mut out = vec![1.0f32; 4];
        magnitude_squared(&inp, &mut out);
        for v in &out { assert_eq!(*v, 0.0); }
    }
}
