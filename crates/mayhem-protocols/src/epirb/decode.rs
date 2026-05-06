//! EPIRB (Emergency Position Indicating Radio Beacon) decoder.
//! Decodes 406 MHz Cospas-Sarsat beacon messages from a bit stream.

#[derive(Debug, Clone)]
pub struct EpirbBeacon {
    pub hex_id: String,
    pub country_code: u16,
    pub protocol: u8,
}

/// Decode an EPIRB beacon from a bit stream (at least 112 bits).
/// Returns `None` if the bit slice is too short.
pub fn decode_epirb(bits: &[bool]) -> Option<EpirbBeacon> {
    if bits.len() < 112 {
        return None;
    }
    let country_code = extract_uint(bits, 27, 10) as u16;
    let protocol = extract_uint(bits, 37, 3) as u8;
    let mut hex_id = String::new();
    let mut i = 25;
    while i < 85 {
        let take = 4.min(bits.len().saturating_sub(i));
        if take == 0 {
            break;
        }
        let n = extract_uint(bits, i, take) as u8;
        hex_id.push(char::from_digit(n as u32, 16).unwrap_or('0'));
        i += 4;
    }
    Some(EpirbBeacon {
        hex_id,
        country_code,
        protocol,
    })
}

fn extract_uint(bits: &[bool], start: usize, len: usize) -> u64 {
    let mut val = 0u64;
    for i in 0..len {
        if start + i < bits.len() && bits[start + i] {
            val |= 1 << (len - 1 - i);
        }
    }
    val
}
