//! AX.25 frame encoder: build UI frames, HDLC bit-stuffing, NRZI encoding.

use super::frame::Callsign;

/// Build a raw AX.25 UI frame (without HDLC flags).
pub fn build_ui_frame(src: &Callsign, dst: &Callsign, payload: &[u8]) -> Vec<u8> {
    let mut frame = Vec::new();
    encode_addr(&mut frame, dst);
    encode_addr_last(&mut frame, src);
    frame.push(0x03); // control: UI
    frame.push(0xF0); // PID: no L3
    frame.extend_from_slice(payload);
    let crc = crc16(&frame);
    frame.push(crc as u8);
    frame.push((crc >> 8) as u8);
    frame
}

/// Apply HDLC bit-stuffing and wrap with opening/closing flags.
pub fn hdlc_encode(frame: &[u8]) -> Vec<u8> {
    let mut bits = Vec::new();
    bits.extend_from_slice(&[0, 1, 1, 1, 1, 1, 1, 0]); // opening flag
    let mut ones = 0u8;
    for &byte in frame {
        for i in 0..8 {
            let bit = (byte >> i) & 1;
            bits.push(bit);
            if bit == 1 {
                ones += 1;
                if ones == 5 {
                    bits.push(0); // zero insertion
                    ones = 0;
                }
            } else {
                ones = 0;
            }
        }
    }
    bits.extend_from_slice(&[0, 1, 1, 1, 1, 1, 1, 0]); // closing flag
    bits
}

/// NRZI encode a bit stream: 0 → transition, 1 → no transition.
pub fn nrzi_encode(bits: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bits.len());
    let mut last = 0u8;
    for &bit in bits {
        if bit == 1 {
            out.push(last); // no transition
        } else {
            last ^= 1;
            out.push(last); // transition
        }
    }
    out
}

fn encode_addr(out: &mut Vec<u8>, call: &Callsign) {
    let bytes = call.call.as_bytes();
    for i in 0..6 {
        out.push(if i < bytes.len() {
            bytes[i] << 1
        } else {
            b' ' << 1
        });
    }
    out.push(0x60 | ((call.ssid & 0x0F) << 1));
}

fn encode_addr_last(out: &mut Vec<u8>, call: &Callsign) {
    let bytes = call.call.as_bytes();
    for i in 0..6 {
        out.push(if i < bytes.len() {
            bytes[i] << 1
        } else {
            b' ' << 1
        });
    }
    out.push(0x61 | ((call.ssid & 0x0F) << 1)); // end bit set
}

fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0x8408;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFF
}
