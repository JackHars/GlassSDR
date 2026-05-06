//! NOAA APT image line decoder.
//! Takes AM-demodulated audio samples (0.0–1.0) and assembles scan lines.

#[derive(Debug, Clone)]
pub struct AptLine {
    pub line_number: u32,
    pub channel: AptChannel,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AptChannel {
    A,
    B,
}

pub struct AptDecoder {
    #[allow(dead_code)]
    samples_per_line: usize,
    current_line: Vec<u8>,
    line_number: u32,
    /// Fractional sample accumulator for pixel rate conversion.
    sample_acc: f32,
    samples_per_pixel: f32,
}

impl AptDecoder {
    /// Create a new decoder for the given audio sample rate.
    /// APT: 2 lines/s × 2080 pixels/line = 4160 pixels/s (sub-carrier rate).
    pub fn new(audio_sample_rate: f32) -> Self {
        let samples_per_line = (audio_sample_rate / 4160.0 * 2080.0).round() as usize;
        let samples_per_pixel = audio_sample_rate / 4160.0;
        Self {
            samples_per_line,
            current_line: Vec::with_capacity(2080),
            line_number: 0,
            sample_acc: 0.0,
            samples_per_pixel,
        }
    }

    /// Feed AM-demodulated samples (0.0–1.0). Returns completed scan lines.
    pub fn process(&mut self, samples: &[f32]) -> Vec<AptLine> {
        let mut lines = Vec::new();
        for &s in samples {
            self.sample_acc += 1.0;
            if self.sample_acc >= self.samples_per_pixel {
                self.sample_acc -= self.samples_per_pixel;
                let pixel = (s.clamp(0.0, 1.0) * 255.0) as u8;
                self.current_line.push(pixel);
            }
            if self.current_line.len() >= 2080 {
                let ch = if self.line_number % 2 == 0 {
                    AptChannel::A
                } else {
                    AptChannel::B
                };
                lines.push(AptLine {
                    line_number: self.line_number,
                    channel: ch,
                    pixels: self.current_line.clone(),
                });
                self.current_line.clear();
                self.line_number += 1;
            }
        }
        lines
    }
}
