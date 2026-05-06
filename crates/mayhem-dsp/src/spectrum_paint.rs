//! Image → IQ via IFFT for waterfall painting.
use num_complex::Complex32;
use std::f32::consts::PI;

pub fn paint_to_iq(image: &[u8], width: usize, height: usize) -> Vec<Complex32> {
    let mut iq = Vec::new();
    for row in 0..height {
        let freq_bins: Vec<Complex32> = (0..width).map(|col| {
            let pixel = image.get(row * width + col).copied().unwrap_or(0) as f32 / 255.0;
            let phase = (row as f32 * 0.37 + col as f32 * 2.71) % (2.0 * PI);
            Complex32::from_polar(pixel, phase)
        }).collect();
        // Simple IDFT
        let time_domain: Vec<Complex32> = (0..width).map(|k| {
            let mut sum = Complex32::new(0.0, 0.0);
            for (n, &bin) in freq_bins.iter().enumerate() {
                let angle = 2.0 * PI * n as f32 * k as f32 / width as f32;
                sum += bin * Complex32::new(angle.cos(), angle.sin());
            }
            sum / width as f32
        }).collect();
        iq.extend_from_slice(&time_domain);
    }
    iq
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paint_returns_width_times_height_samples() {
        let w = 8;
        let h = 4;
        let image = vec![128u8; w * h];
        let iq = paint_to_iq(&image, w, h);
        assert_eq!(iq.len(), w * h);
    }

    #[test]
    fn all_black_image_is_silent() {
        let w = 4;
        let h = 2;
        let image = vec![0u8; w * h];
        let iq = paint_to_iq(&image, w, h);
        for sample in &iq {
            assert!(sample.norm() < 1e-6, "expected near-zero amplitude for black pixel");
        }
    }
}
