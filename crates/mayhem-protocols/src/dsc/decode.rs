//! Digital Selective Calling (DSC) message decoder.
//! ITU-R M.493 compliant symbol-level decode.

#[derive(Debug, Clone)]
pub struct DscMessage {
    pub mmsi: u32,
    pub category: DscCategory,
    pub format_code: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DscCategory {
    Routine,
    Safety,
    Urgency,
    Distress,
}

/// Decode a DSC message from a symbol stream.
/// Returns `None` if the symbol slice is too short to form a valid message.
pub fn decode_dsc(symbols: &[u8]) -> Option<DscMessage> {
    if symbols.len() < 20 {
        return None;
    }
    let format_code = symbols[0] & 0x7F;
    let cat = match format_code {
        112 => DscCategory::Distress,
        110 => DscCategory::Urgency,
        108 => DscCategory::Safety,
        _ => DscCategory::Routine,
    };
    let mut mmsi = 0u32;
    for i in 1..10 {
        mmsi = mmsi * 10 + (symbols[i] & 0x0F) as u32;
    }
    Some(DscMessage {
        mmsi,
        category: cat,
        format_code,
    })
}
