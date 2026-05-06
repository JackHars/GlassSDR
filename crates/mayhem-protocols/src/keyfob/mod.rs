//! Fixed-code keyfob encoder (PT2262/EV1527).

pub fn encode_pt2262(code: u32, bits: u8, repeats: u32) -> Vec<(u32, u32)> {
    let short = 350u32;
    let long = 1050u32;
    let sync_gap = 10850u32;
    let mut pulses = Vec::new();
    for _ in 0..repeats {
        pulses.push((short, sync_gap)); // sync
        for i in (0..bits).rev() {
            if (code >> i) & 1 == 1 {
                pulses.push((long, short));
            } else {
                pulses.push((short, long));
            }
        }
    }
    pulses
}

pub fn pulses_to_baseband(pulses: &[(u32, u32)], sample_rate: f32) -> Vec<u8> {
    let mut bb = Vec::new();
    for &(high_us, low_us) in pulses {
        let h = (high_us as f32 * sample_rate / 1e6).round() as usize;
        let l = (low_us as f32 * sample_rate / 1e6).round() as usize;
        bb.extend(std::iter::repeat(1u8).take(h));
        bb.extend(std::iter::repeat(0u8).take(l));
    }
    bb
}
