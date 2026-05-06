//! Pulse timing analyzer. Takes binary stream (0/1) and measures pulse/gap durations.
//! Also classifies encoding type from timing statistics.

/// A pulse or gap event.
#[derive(Debug, Clone, Copy)]
pub struct PulseEvent {
    pub is_high: bool,
    pub duration_samples: u32,
}

/// Encoding classification result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PulseEncoding {
    PulseDistance,  // fixed pulse width, variable gap
    PulseWidth,    // variable pulse width, fixed gap
    Manchester,    // equal pulse/gap
    Raw,
}

pub struct PulseAnalyzer {
    last_level: u8,
    run_length: u32,
    min_samples: u32, // ignore glitches
}

impl PulseAnalyzer {
    pub fn new(min_samples: u32) -> Self {
        Self { last_level: 0, run_length: 0, min_samples }
    }

    /// Process binary input, emit pulse events on transitions.
    pub fn process(&mut self, input: &[u8], out: &mut Vec<PulseEvent>) {
        for &level in input {
            if level == self.last_level {
                self.run_length += 1;
            } else {
                if self.run_length >= self.min_samples {
                    out.push(PulseEvent {
                        is_high: self.last_level != 0,
                        duration_samples: self.run_length,
                    });
                }
                self.last_level = level;
                self.run_length = 1;
            }
        }
    }
}

/// Classify pulse encoding from a set of events.
pub fn classify_encoding(events: &[PulseEvent]) -> PulseEncoding {
    if events.len() < 6 { return PulseEncoding::Raw; }

    let highs: Vec<u32> = events.iter().filter(|e| e.is_high).map(|e| e.duration_samples).collect();
    let lows: Vec<u32> = events.iter().filter(|e| !e.is_high).map(|e| e.duration_samples).collect();

    if highs.is_empty() || lows.is_empty() { return PulseEncoding::Raw; }

    let high_ratio = variation_ratio(&highs);
    let low_ratio = variation_ratio(&lows);

    // Low variation in highs + high variation in lows = pulse-distance
    if high_ratio < 0.3 && low_ratio > 0.4 { return PulseEncoding::PulseDistance; }
    // High variation in highs + low variation in lows = pulse-width
    if high_ratio > 0.4 && low_ratio < 0.3 { return PulseEncoding::PulseWidth; }
    // Both low variation = Manchester
    if high_ratio < 0.3 && low_ratio < 0.3 { return PulseEncoding::Manchester; }

    PulseEncoding::Raw
}

fn variation_ratio(values: &[u32]) -> f32 {
    if values.is_empty() { return 0.0; }
    let min = *values.iter().min().unwrap() as f32;
    let max = *values.iter().max().unwrap() as f32;
    if max == 0.0 { return 0.0; }
    (max - min) / max
}
