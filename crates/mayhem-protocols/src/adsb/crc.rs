//! Mode-S CRC-24. Polynomial: 0xFFF409. Computed over the 88 message bits;
//! the 24-bit CRC follows. For a valid frame, CRC of the first 88 bits XORed
//! with the trailing 24 bits == 0 (or in some message types == ICAO address;
//! for DF17 we accept zero only).

pub fn crc24(bytes: &[u8]) -> u32 {
    let polynomial: u32 = 0x1FFF409; // 25-bit including the leading 1
    let mut crc: u32 = 0;
    for &b in bytes {
        crc ^= (b as u32) << 16;
        for _ in 0..8 {
            crc <<= 1;
            if crc & 0x1_000_000 != 0 {
                crc ^= polynomial;
            }
        }
    }
    crc & 0xFFFFFF
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Known-good DF17 frame's first 11 bytes (88 bits) → CRC equals last 3 bytes.
    #[test]
    fn klm1023_crc_matches_trailing_bytes() {
        // "8D4840D6202CC371C32CE0576098"
        // first 11 bytes (88 bits):
        let body: &[u8] = &[
            0x8D, 0x48, 0x40, 0xD6, 0x20, 0x2C, 0xC3, 0x71, 0xC3, 0x2C, 0xE0,
        ];
        // CRC bytes:
        let crc_in_frame: u32 = 0x57_60_98;
        assert_eq!(crc24(body), crc_in_frame);
    }
}
