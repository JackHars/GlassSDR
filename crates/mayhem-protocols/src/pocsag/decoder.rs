//! POCSAG decoder: bitstream → decoded pager messages.
//! Inverse of the encoder.

use super::codeword::{idle_codeword, sync_codeword};

#[derive(Debug, Clone)]
pub struct DecodedPage {
    pub ric: u32,
    pub function: u8,
    pub content: DecodedContent,
}

#[derive(Debug, Clone)]
pub enum DecodedContent {
    Numeric(String),
    Alphanumeric(String),
    ToneOnly,
}

/// Decode POCSAG bitstream (after FSK demod + clock recovery).
pub fn decode_pocsag_bitstream(bits: &[bool]) -> Vec<DecodedPage> {
    let mut pages = Vec::new();
    let mut pos = 0;

    // Find first sync
    pos = find_sync(bits, pos);

    while pos + 544 <= bits.len() {
        let sync = bits_to_u32(&bits[pos..pos + 32]);
        if sync != sync_codeword() {
            pos += 1;
            pos = find_sync(bits, pos);
            continue;
        }
        pos += 32; // skip sync

        // Read 16 codewords
        let mut batch = [0u32; 16];
        for i in 0..16 {
            if pos + 32 > bits.len() { break; }
            batch[i] = bits_to_u32(&bits[pos..pos + 32]);
            pos += 32;
        }

        // Process codewords in this batch
        let mut slot = 0;
        while slot < 16 {
            let cw = batch[slot];
            if cw == idle_codeword() || cw == sync_codeword() {
                slot += 1;
                continue;
            }

            let flag = cw >> 31;
            if flag == 0 {
                // Address codeword
                let addr_field = (cw >> 13) & 0x3FFFF;
                let func = ((cw >> 11) & 0x03) as u8;
                let frame_pos = slot / 2;
                let ric = (addr_field << 3) | (frame_pos as u32);

                // Collect following message codewords
                let mut msg_bits: Vec<bool> = Vec::new();
                slot += 1;
                while slot < 16 {
                    let mcw = batch[slot];
                    if mcw == idle_codeword() || mcw == sync_codeword() { break; }
                    let mflag = mcw >> 31;
                    if mflag != 1 { break; } // not a message codeword
                    let data = (mcw >> 11) & 0xFFFFF;
                    for bit_idx in (0..20).rev() {
                        msg_bits.push((data >> bit_idx) & 1 == 1);
                    }
                    slot += 1;
                }

                let content = if msg_bits.is_empty() {
                    DecodedContent::ToneOnly
                } else {
                    decode_alpha(&msg_bits)
                };

                pages.push(DecodedPage { ric, function: func, content });
            } else {
                slot += 1;
            }
        }
    }

    pages
}

fn decode_alpha(bits: &[bool]) -> DecodedContent {
    let mut chars = Vec::new();
    for chunk in bits.chunks(7) {
        if chunk.len() < 7 { break; }
        let mut val = 0u8;
        for (i, &b) in chunk.iter().enumerate() {
            if b { val |= 1 << i; } // LSB first
        }
        if val == 0 { break; }
        if val >= 32 && val < 127 {
            chars.push(val as char);
        }
    }
    if chars.is_empty() {
        DecodedContent::ToneOnly
    } else {
        DecodedContent::Alphanumeric(chars.into_iter().collect())
    }
}

fn find_sync(bits: &[bool], start: usize) -> usize {
    let mut pos = start;
    while pos + 32 <= bits.len() {
        if bits_to_u32(&bits[pos..pos + 32]) == sync_codeword() {
            return pos;
        }
        pos += 1;
    }
    bits.len()
}

fn bits_to_u32(bits: &[bool]) -> u32 {
    let mut val = 0u32;
    for (i, &b) in bits.iter().take(32).enumerate() {
        if b { val |= 1 << (31 - i); }
    }
    val
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pocsag::encoder::{encode_pocsag, MessageType, PocsagMessage};

    #[test]
    fn decode_tone_only() {
        let msg = PocsagMessage {
            ric: 8, function: 2, content: MessageType::ToneOnly, baud_rate: 512,
        };
        let bits = encode_pocsag(&msg);
        let pages = decode_pocsag_bitstream(&bits);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].ric, 8);
        assert_eq!(pages[0].function, 2);
        assert!(matches!(pages[0].content, DecodedContent::ToneOnly));
    }

    #[test]
    fn decode_alphanumeric_roundtrip() {
        let msg = PocsagMessage {
            ric: 1234568, function: 0,
            content: MessageType::Alphanumeric("HELLO".to_string()),
            baud_rate: 1200,
        };
        let bits = encode_pocsag(&msg);
        let pages = decode_pocsag_bitstream(&bits);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].ric, 1234568);
        match &pages[0].content {
            DecodedContent::Alphanumeric(s) => assert!(s.starts_with("HELLO"), "got: {s}"),
            other => panic!("expected Alphanumeric, got {:?}", other),
        }
    }
}
