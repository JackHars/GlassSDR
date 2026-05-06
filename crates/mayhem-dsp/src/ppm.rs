//! PPM bit slicer for 1090ES. After preamble detection, slices 112 bits / 14 bytes.
//! The data starts 16 samples after the preamble offset (i.e., immediately after the preamble).

/// `mag` is magnitude-squared; `data_start` is the sample index where the data symbols begin
/// (typically `preamble_offset + 16`). Returns the 14 raw bytes; caller must validate via CRC.
pub fn slice_frame(mag: &[f32], data_start: usize) -> Option<[u8; 14]> {
    let needed = 112 * 2;
    if data_start + needed > mag.len() {
        return None;
    }
    let mut bits = [0u8; 112];
    for b in 0..112 {
        let i = data_start + b * 2;
        bits[b] = if mag[i] > mag[i + 1] { 1 } else { 0 };
    }
    let mut out = [0u8; 14];
    for byte in 0..14 {
        let mut v = 0u8;
        for k in 0..8 {
            v = (v << 1) | bits[byte * 8 + k];
        }
        out[byte] = v;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthesize a magnitude buffer corresponding to a known message and confirm slicing.
    #[test]
    fn slices_known_message_bytes() {
        // Encode "8D4840D6202CC371C32CE0576098" as PPM into a magnitude buffer.
        let bytes = [
            0x8D, 0x48, 0x40, 0xD6, 0x20, 0x2C, 0xC3, 0x71, 0xC3, 0x2C, 0xE0, 0x57, 0x60, 0x98,
        ];
        // Preamble (16) + data (224)
        let mut mag = vec![0.0f32; 16 + 224 + 16];
        let data_start = 16;
        for byte in 0..14 {
            for k in 0..8 {
                let bit = (bytes[byte] >> (7 - k)) & 1;
                let idx = data_start + (byte * 8 + k) * 2;
                if bit == 1 {
                    mag[idx] = 1.0;
                    mag[idx + 1] = 0.0;
                } else {
                    mag[idx] = 0.0;
                    mag[idx + 1] = 1.0;
                }
            }
        }
        let out = slice_frame(&mag, data_start).expect("slice");
        assert_eq!(&out[..], &bytes[..]);
    }

    #[test]
    fn refuses_short_buffer() {
        let mag = vec![0.0f32; 100];
        assert!(slice_frame(&mag, 0).is_none());
    }
}
