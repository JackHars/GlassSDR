//! Generalized FSK symbol slicer.
//! Input: f32 (FM demod output — frequency deviation).
//! Output: u8 symbols at the baud rate.
//! Performs threshold slicing with simple clock recovery (peak sample within symbol window).

pub struct FskSlicer {
    levels: u8,             // 2 or 4
    samples_per_symbol: f32,
    counter: f32,
    last_sample: f32,
    best_sample: f32,       // peak absolute value within current symbol
}

impl FskSlicer {
    pub fn two_level(baud_rate: f32, sample_rate: f32) -> Self {
        Self {
            levels: 2,
            samples_per_symbol: sample_rate / baud_rate,
            counter: 0.0,
            last_sample: 0.0,
            best_sample: 0.0,
        }
    }

    pub fn four_level(baud_rate: f32, sample_rate: f32) -> Self {
        Self {
            levels: 4,
            samples_per_symbol: sample_rate / baud_rate,
            counter: 0.0,
            last_sample: 0.0,
            best_sample: 0.0,
        }
    }

    pub fn process(&mut self, input: &[f32], out: &mut Vec<u8>) {
        for &sample in input {
            // Track the sample with largest absolute value in this symbol period
            // (approximates optimal sampling point)
            if sample.abs() > self.best_sample.abs() {
                self.best_sample = sample;
            }

            self.counter += 1.0;

            if self.counter >= self.samples_per_symbol {
                // Decision point — slice the best sample
                let symbol = match self.levels {
                    4 => self.slice_4fsk(self.best_sample),
                    _ => self.slice_2fsk(self.best_sample),
                };
                out.push(symbol);
                self.counter -= self.samples_per_symbol;
                self.best_sample = 0.0;
            }
            self.last_sample = sample;
        }
    }

    fn slice_2fsk(&self, sample: f32) -> u8 {
        if sample >= 0.0 { 1 } else { 0 }
    }

    fn slice_4fsk(&self, sample: f32) -> u8 {
        if sample > 0.5 { 3 }
        else if sample > 0.0 { 2 }
        else if sample > -0.5 { 1 }
        else { 0 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_fsk_output_rate() {
        let mut slicer = FskSlicer::two_level(1200.0, 48000.0);
        // 48000/1200 = 40 samples per symbol. 400 samples = 10 symbols.
        let input = vec![0.5f32; 400];
        let mut out = Vec::new();
        slicer.process(&input, &mut out);
        assert_eq!(out.len(), 10);
    }

    #[test]
    fn two_fsk_positive_gives_ones() {
        let mut slicer = FskSlicer::two_level(1200.0, 48000.0);
        let input = vec![0.8f32; 400]; // all positive
        let mut out = Vec::new();
        slicer.process(&input, &mut out);
        assert!(out.iter().all(|&s| s == 1));
    }

    #[test]
    fn two_fsk_negative_gives_zeros() {
        let mut slicer = FskSlicer::two_level(1200.0, 48000.0);
        let input = vec![-0.6f32; 400]; // all negative
        let mut out = Vec::new();
        slicer.process(&input, &mut out);
        assert!(out.iter().all(|&s| s == 0));
    }

    #[test]
    fn four_fsk_levels() {
        let mut slicer = FskSlicer::four_level(1600.0, 48000.0);
        // 48000/1600 = 30 samples per symbol
        let mut input = Vec::new();
        input.extend(vec![0.8f32; 30]);  // symbol 3
        input.extend(vec![0.2f32; 30]);  // symbol 2
        input.extend(vec![-0.2f32; 30]); // symbol 1
        input.extend(vec![-0.8f32; 30]); // symbol 0
        let mut out = Vec::new();
        slicer.process(&input, &mut out);
        assert_eq!(out, vec![3, 2, 1, 0]);
    }
}
