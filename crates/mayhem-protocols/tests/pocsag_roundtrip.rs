//! Round-trip test: encode POCSAG message, then decode the bitstream and verify
//! the original message is recovered at all three baud rates.

use mayhem_protocols::pocsag::codeword::sync_codeword;
use mayhem_protocols::pocsag::codeword::idle_codeword;
use mayhem_protocols::pocsag::encoder::{encode_pocsag, MessageType, PocsagMessage};

fn bits_to_u32(bits: &[bool]) -> u32 {
    let mut val = 0u32;
    for (i, &b) in bits.iter().take(32).enumerate() {
        if b { val |= 1 << (31 - i); }
    }
    val
}

/// Minimal decoder: extract RIC and alphanumeric message from encoded bitstream.
fn decode_bitstream(bits: &[bool]) -> Option<(u32, String)> {
    // Skip 576-bit preamble
    if bits.len() < 608 { return None; }
    let bits = &bits[576..];

    // Find sync
    if bits.len() < 32 { return None; }
    let sync = bits_to_u32(&bits[0..32]);
    if sync != sync_codeword() { return None; }

    let codewords = &bits[32..];
    let mut ric: u32 = 0;
    let mut msg_bits: Vec<bool> = Vec::new();
    let mut found_address = false;

    for (i, chunk) in codewords.chunks(32).enumerate() {
        if chunk.len() < 32 { break; }
        let cw = bits_to_u32(chunk);

        if cw == sync_codeword() { continue; }
        if cw == idle_codeword() { continue; }

        let flag = cw >> 31;
        if flag == 0 && !found_address {
            // Address codeword
            let addr_field = (cw >> 13) & 0x3FFFF;
            let frame_pos = (i % 16) / 2;
            ric = (addr_field << 3) | (frame_pos as u32);
            found_address = true;
        } else if flag == 1 && found_address {
            // Message codeword — extract 20 data bits (bits 30-11)
            let data = (cw >> 11) & 0xFFFFF;
            for bit_idx in (0..20).rev() {
                msg_bits.push((data >> bit_idx) & 1 == 1);
            }
        }
    }

    if !found_address { return None; }

    // Decode 7-bit LSB-first alphanumeric
    let mut chars = Vec::new();
    for chunk in msg_bits.chunks(7) {
        if chunk.len() < 7 { break; }
        let mut val = 0u8;
        for (i, &b) in chunk.iter().enumerate() {
            if b { val |= 1 << i; }
        }
        if val == 0 { break; }
        if val >= 32 && val < 127 {
            chars.push(val as char);
        }
    }

    Some((ric, chars.into_iter().collect()))
}

#[test]
fn roundtrip_alphanumeric_512() {
    roundtrip("HELLO WORLD", 1234568, 512);  // RIC must have frame_pos that works with our simple decoder
}

#[test]
fn roundtrip_alphanumeric_1200() {
    roundtrip("TEST MSG", 8, 1200);  // frame pos 0
}

#[test]
fn roundtrip_alphanumeric_2400() {
    roundtrip("QUICK", 16, 2400);  // frame pos 0
}

fn roundtrip(text: &str, ric: u32, baud: u16) {
    let msg = PocsagMessage {
        ric,
        function: 0,
        content: MessageType::Alphanumeric(text.to_string()),
        baud_rate: baud,
    };
    let bits = encode_pocsag(&msg);

    let (decoded_ric, decoded_text) = decode_bitstream(&bits)
        .unwrap_or_else(|| panic!("Failed to decode at {baud} baud"));

    assert_eq!(decoded_ric, ric, "RIC mismatch at {baud} baud");
    assert!(
        decoded_text.starts_with(text),
        "Message mismatch at {baud} baud: expected starts_with '{text}', got '{decoded_text}'"
    );
}
