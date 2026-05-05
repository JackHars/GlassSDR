//! DF17 frame: 5-bit DF + 3-bit CA + 24-bit ICAO24 + 56-bit ME + 24-bit CRC = 112 bits / 14 bytes.

use super::crc::crc24;

#[derive(Debug, thiserror::Error)]
pub enum AdsbError {
    #[error("frame must be exactly 14 bytes, got {0}")]
    BadLength(usize),
    #[error("not a DF17 frame (DF = {0})")]
    NotDf17(u8),
    #[error("CRC check failed")]
    CrcMismatch,
}

pub type Result<T> = std::result::Result<T, AdsbError>;

#[derive(Debug, Clone, Copy)]
pub struct AdsbFrame<'a> {
    pub df: u8,
    pub ca: u8,
    pub icao24: [u8; 3],
    pub me: &'a [u8], // 7 bytes
    pub tc: u8,
}

impl<'a> AdsbFrame<'a> {
    pub fn parse(bytes: &'a [u8]) -> Result<Self> {
        if bytes.len() != 14 {
            return Err(AdsbError::BadLength(bytes.len()));
        }
        let df = bytes[0] >> 3;
        if df != 17 {
            return Err(AdsbError::NotDf17(df));
        }
        // Verify CRC: bytes[0..11] CRC must equal bytes[11..14] big-endian
        let computed = crc24(&bytes[..11]);
        let in_frame: u32 = ((bytes[11] as u32) << 16)
            | ((bytes[12] as u32) << 8)
            | (bytes[13] as u32);
        if computed != in_frame {
            return Err(AdsbError::CrcMismatch);
        }
        let ca = bytes[0] & 0x07;
        let icao24 = [bytes[1], bytes[2], bytes[3]];
        let me = &bytes[4..11];
        let tc = me[0] >> 3;
        Ok(Self {
            df,
            ca,
            icao24,
            me,
            tc,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hex::decode;

    fn parse_hex_frame(hex: &str) -> Vec<u8> {
        decode(hex).unwrap()
    }

    #[test]
    fn parses_klm1023_aircraft_id() {
        let bytes = parse_hex_frame("8D4840D6202CC371C32CE0576098");
        let f = AdsbFrame::parse(&bytes).unwrap();
        assert_eq!(f.df, 17);
        assert_eq!(f.icao24, [0x48, 0x40, 0xD6]);
        assert_eq!(f.tc, 4); // Aircraft ID family
    }

    #[test]
    fn parses_airborne_position_even() {
        let bytes = parse_hex_frame("8D40621D58C382D690C8AC2863A7");
        let f = AdsbFrame::parse(&bytes).unwrap();
        assert_eq!(f.df, 17);
        assert_eq!(f.icao24, [0x40, 0x62, 0x1D]);
        assert_eq!(f.tc, 11); // Airborne Position
    }

    #[test]
    fn rejects_wrong_length() {
        assert!(matches!(
            AdsbFrame::parse(&[0u8; 13]),
            Err(AdsbError::BadLength(13))
        ));
    }

    #[test]
    fn rejects_corrupted_crc() {
        let mut bytes = parse_hex_frame("8D4840D6202CC371C32CE0576098");
        bytes[5] ^= 0x01; // flip a bit in the message
        assert!(matches!(
            AdsbFrame::parse(&bytes),
            Err(AdsbError::CrcMismatch)
        ));
    }

    #[test]
    fn rejects_non_df17() {
        let mut bytes = vec![0u8; 14];
        bytes[0] = 11 << 3; // DF = 11, not 17
        assert!(matches!(
            AdsbFrame::parse(&bytes),
            Err(AdsbError::NotDf17(11))
        ));
    }
}
