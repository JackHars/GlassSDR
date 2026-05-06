//! Simple BPSK demodulator: Costas loop carrier recovery + threshold slicer.
//! Input: Complex32 samples, Output: u8 bits (0 or 1).

use num_complex::Complex32;
use std::f32::consts::PI;

pub struct BpskDemod {
    phase: f32,
    freq: f32,
    alpha: f32,
    beta: f32,
    samples_per_symbol: f32,
    counter: f32,
}

impl BpskDemod {
    pub fn new(symbol_rate: f32, sample_rate: f32) -> Self {
        let sps = sample_rate / symbol_rate;
        let bw = 0.01;
        Self {
            phase: 0.0,
            freq: 0.0,
            alpha: bw * 2.0,
            beta: bw * bw,
            samples_per_symbol: sps,
            counter: 0.0,
        }
    }

    pub fn process(&mut self, input: &[Complex32], out: &mut Vec<u8>) {
        for &s in input {
            let osc = Complex32::new(self.phase.cos(), -self.phase.sin());
            let mixed = s * osc;
            let error = mixed.re.signum() * mixed.im;
            self.freq += self.beta * error;
            self.phase += self.freq + self.alpha * error;
            if self.phase > PI {
                self.phase -= 2.0 * PI;
            }
            if self.phase < -PI {
                self.phase += 2.0 * PI;
            }
            self.counter += 1.0;
            if self.counter >= self.samples_per_symbol {
                out.push(if mixed.re >= 0.0 { 1 } else { 0 });
                self.counter -= self.samples_per_symbol;
            }
        }
    }
}
