//! Flipper Zero .sub file parser.

#[derive(Debug, Clone)]
pub struct FlipperSubFile {
    pub frequency: f64,
    pub raw_data: Vec<i32>,
}

pub fn parse_sub_file(content: &str) -> Option<FlipperSubFile> {
    let mut freq = 0.0f64;
    let mut raw = Vec::new();
    for line in content.lines() {
        if let Some(v) = line.strip_prefix("Frequency: ") {
            freq = v.trim().parse().ok()?;
        }
        if let Some(v) = line.strip_prefix("RAW_Data: ") {
            for tok in v.split_whitespace() {
                if let Ok(n) = tok.parse::<i32>() {
                    raw.push(n);
                }
            }
        }
    }
    if freq == 0.0 || raw.is_empty() {
        None
    } else {
        Some(FlipperSubFile {
            frequency: freq,
            raw_data: raw,
        })
    }
}

pub fn sub_to_baseband(sub: &FlipperSubFile, sample_rate: f32) -> Vec<u8> {
    let mut bb = Vec::new();
    for &dur in &sub.raw_data {
        let n = (dur.unsigned_abs() as f32 * sample_rate / 1e6).round() as usize;
        let level = if dur > 0 { 1u8 } else { 0 };
        bb.extend(std::iter::repeat(level).take(n));
    }
    bb
}
