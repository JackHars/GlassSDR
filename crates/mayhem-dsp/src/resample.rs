//! Audio resampler using rubato's FftFixedIn for arbitrary input rates → 48 kHz output.

use anyhow::Result;
use rubato::{FftFixedIn, Resampler};

pub struct AudioResampler {
    inner: FftFixedIn<f32>,
    in_rate: usize,
    out_rate: usize,
    block_size: usize,
    accumulator: Vec<f32>,
}

impl AudioResampler {
    pub fn new(in_rate: usize, out_rate: usize, block_size: usize) -> Result<Self> {
        if in_rate == 0 || out_rate == 0 {
            anyhow::bail!("rate must be > 0");
        }
        let inner = FftFixedIn::<f32>::new(in_rate, out_rate, block_size, 2, 1)?;
        Ok(Self {
            inner,
            in_rate,
            out_rate,
            block_size,
            accumulator: Vec::with_capacity(block_size * 2),
        })
    }

    pub fn process(&mut self, input: &[f32], out: &mut Vec<i16>) -> Result<()> {
        self.accumulator.extend_from_slice(input);
        while self.accumulator.len() >= self.block_size {
            let chunk: Vec<f32> = self.accumulator.drain(..self.block_size).collect();
            let resampled = self.inner.process(&[chunk], None)?;
            for &s in &resampled[0] {
                let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                out.push(v);
            }
        }
        Ok(())
    }

    pub fn in_rate(&self) -> usize { self.in_rate }
    pub fn out_rate(&self) -> usize { self.out_rate }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resample_240k_to_48k_produces_5x_fewer_samples() {
        let block = 1024;
        let mut r = AudioResampler::new(240_000, 48_000, block).unwrap();
        let input = vec![0.1f32; block * 4];
        let mut out = Vec::new();
        r.process(&input, &mut out).unwrap();
        // 4*block input @ 240k → expect ≈ 4*block/5 = 819 output
        let expected_min = (input.len() / 5) - 100;
        let expected_max = (input.len() / 5) + 100;
        assert!(
            out.len() >= expected_min && out.len() <= expected_max,
            "out.len() = {}, expected ≈ {}",
            out.len(),
            input.len() / 5
        );
    }

    #[test]
    fn resampler_rejects_invalid_rates() {
        let r = AudioResampler::new(0, 48_000, 1024);
        assert!(r.is_err());
    }
}
