//! RFM69 packet builder.

pub fn build_rfm69_packet(sync_word: &[u8], node_addr: u8, payload: &[u8]) -> Vec<u8> {
    let mut pkt = vec![0xAA; 4]; // preamble
    pkt.extend_from_slice(sync_word);
    pkt.push(payload.len() as u8 + 1);
    pkt.push(node_addr);
    pkt.extend_from_slice(payload);
    pkt
}
