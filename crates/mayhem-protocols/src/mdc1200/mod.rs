//! MDC-1200 signaling encoder.

pub struct Mdc1200Packet {
    pub unit_id: u16,
    pub opcode: u8,
}

pub fn encode_mdc1200(pkt: &Mdc1200Packet) -> Vec<u8> {
    let mut bits = Vec::new();
    for i in 0..40 {
        bits.push((i % 2) as u8);
    } // preamble
    bits.extend_from_slice(&[0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1]); // sync 0x07 0x09
    for i in (0..8).rev() {
        bits.push((pkt.opcode >> i) & 1);
    }
    for i in (0..16).rev() {
        bits.push(((pkt.unit_id >> i) & 1) as u8);
    }
    let chk = pkt.opcode ^ (pkt.unit_id >> 8) as u8 ^ pkt.unit_id as u8;
    for i in (0..8).rev() {
        bits.push((chk >> i) & 1);
    }
    bits
}
