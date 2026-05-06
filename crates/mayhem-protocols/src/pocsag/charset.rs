//! Character encoding for POCSAG numeric and alphanumeric messages.

/// Encode a numeric message string into a bit vector (4 bits per character, MSB first).
///
/// Supported characters:
/// - '0'–'9' → 0x0–0x9
/// - '*'      → 0xA
/// - 'U'/'u'  → 0xB
/// - ' '      → 0xC
/// - '-'      → 0xD
/// - ']'      → 0xE
/// - '['      → 0xF
///
/// Any other character maps to space (0xC).
pub fn encode_numeric(msg: &str) -> Vec<bool> {
    let mut bits = Vec::with_capacity(msg.len() * 4);
    for ch in msg.chars() {
        let nibble: u8 = match ch {
            '0' => 0x0,
            '1' => 0x1,
            '2' => 0x2,
            '3' => 0x3,
            '4' => 0x4,
            '5' => 0x5,
            '6' => 0x6,
            '7' => 0x7,
            '8' => 0x8,
            '9' => 0x9,
            '*' => 0xA,
            'U' | 'u' => 0xB,
            ' ' => 0xC,
            '-' => 0xD,
            ']' => 0xE,
            '[' => 0xF,
            _ => 0xC, // invalid → space
        };
        // Emit 4 bits, MSB first
        bits.push((nibble & 0x8) != 0);
        bits.push((nibble & 0x4) != 0);
        bits.push((nibble & 0x2) != 0);
        bits.push((nibble & 0x1) != 0);
    }
    bits
}

/// Encode an alphanumeric message string into a bit vector (7 bits per character, LSB first).
///
/// Each character is encoded as 7-bit ASCII with the least significant bit emitted first
/// (POCSAG convention). Characters with code points >= 128 are replaced with '?' (0x3F).
pub fn encode_alphanumeric(msg: &str) -> Vec<bool> {
    let mut bits = Vec::with_capacity(msg.len() * 7);
    for ch in msg.chars() {
        let byte: u8 = if ch.is_ascii() {
            ch as u8
        } else {
            b'?' // 0x3F
        };
        // Emit 7 bits, LSB first
        for shift in 0..7u8 {
            bits.push((byte >> shift) & 1 != 0);
        }
    }
    bits
}
