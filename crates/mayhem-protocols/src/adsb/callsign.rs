//! Aircraft Identification (TC 1-4). The 56-bit ME body is:
//!   TC (5 bits) + Wake Vortex Cat (3 bits) + 8 chars × 6 bits.
//! Each char is encoded against this 64-char alphabet (`#` is the spec's
//! "padding" symbol; we render it as `_` to make stripping obvious).

const ALPHABET: &[u8; 64] =
    b"#ABCDEFGHIJKLMNOPQRSTUVWXYZ##### ###############0123456789######";

pub fn decode(me: &[u8]) -> String {
    debug_assert_eq!(me.len(), 7);
    // The 8 6-bit characters span ME bits 8..56 (48 bits).
    // Pack the relevant bits into a single u64.
    let mut bits: u64 = 0;
    for &b in &me[1..7] {
        // 6 bytes = 48 bits
        bits = (bits << 8) | (b as u64);
    }
    let mut out = String::with_capacity(8);
    for i in 0..8 {
        let shift = 6 * (7 - i);
        let idx = ((bits >> shift) & 0x3F) as usize;
        let c = ALPHABET[idx];
        if c == b'#' {
            out.push('_');
        } else {
            out.push(c as char);
        }
    }
    out.trim_end_matches(|c| c == ' ' || c == '_').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adsb::frame::AdsbFrame;
    use hex::decode as hex_decode;

    #[test]
    fn klm1023_callsign() {
        let bytes = hex_decode("8D4840D6202CC371C32CE0576098").unwrap();
        let f = AdsbFrame::parse(&bytes).unwrap();
        assert!(f.tc >= 1 && f.tc <= 4);
        let cs = decode(f.me);
        assert_eq!(cs, "KLM1023");
    }
}
