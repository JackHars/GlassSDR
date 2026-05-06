//! FLEX pager protocol decoder (basic — Phase A, 1600 baud structure).

#[derive(Debug, Clone)]
pub struct FlexMessage {
    pub capcode: u32,
    pub message: String,
    pub cycle: u8,
    pub frame: u8,
}

/// Decode FLEX frame from 2-FSK symbols (1600 symbols = 1 second frame).
/// Returns decoded messages (may be empty if frame contains no readable data).
pub fn decode_flex_frame(symbols: &[u8]) -> Vec<FlexMessage> {
    if symbols.len() < 1600 { return vec![]; }
    // FLEX: Sync1(112) + FIW(32) + 11 data blocks(32 each)
    // Extract FIW for cycle/frame info
    let fiw = symbols_to_u32(&symbols[112..144]);
    let _cycle = ((fiw >> 4) & 0x0F) as u8;
    let _frame = ((fiw >> 8) & 0x7F) as u8;
    // Full FLEX decode requires block interleave + BCH — stub for now
    vec![]
}

fn symbols_to_u32(syms: &[u8]) -> u32 {
    let mut val = 0u32;
    for (i, &s) in syms.iter().take(32).enumerate() {
        if s != 0 { val |= 1 << (31 - i); }
    }
    val
}
