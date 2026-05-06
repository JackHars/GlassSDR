//! nRF24L01+ Enhanced ShockBurst frame builder.

#[derive(Debug, Clone)]
pub struct Nrf24Packet {
    pub bytes: Vec<u8>,
}

pub fn build_shockburst(address: &[u8], payload: &[u8]) -> Nrf24Packet {
    let mut pkt = Vec::new();
    pkt.push(if address.first().map_or(false, |&b| b & 0x80 != 0) {
        0x55
    } else {
        0xAA
    });
    pkt.extend_from_slice(address);
    pkt.push(((payload.len() as u8) & 0x3F) << 2); // PCF: length + PID=0 + NO_ACK=0
    pkt.push(0);
    pkt.extend_from_slice(payload);
    let crc = nrf_crc16(&pkt[1..]); // over address+PCF+payload
    pkt.push((crc >> 8) as u8);
    pkt.push(crc as u8);
    Nrf24Packet { bytes: pkt }
}

pub fn packet_to_symbols(pkt: &Nrf24Packet) -> Vec<u8> {
    pkt.bytes
        .iter()
        .flat_map(|&b| (0..8).rev().map(move |i| (b >> i) & 1))
        .collect() // MSB first
}

pub fn nrf_crc16(data: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}
