//! BLE advertising channel PDU builder.
pub const BLE_ADV_FREQ: [(u8, f64); 3] = [(37, 2402e6), (38, 2426e6), (39, 2480e6)];

#[derive(Debug, Clone)]
pub struct BleAdvPacket {
    pub channel: u8,
    pub bytes: Vec<u8>,
}

pub fn build_adv_packet(addr: &[u8; 6], adv_data: &[u8], channel: u8) -> BleAdvPacket {
    let mut pkt = Vec::new();
    pkt.push(0xAA); // preamble
    pkt.extend_from_slice(&[0xD6, 0xBE, 0x89, 0x8E]); // access addr (LE)
    // PDU header: type=0x02 (ADV_NONCONN_IND), length
    let pdu_len = (6 + adv_data.len().min(31)) as u8;
    pkt.push(0x02);
    pkt.push(pdu_len);
    pkt.extend_from_slice(addr);
    pkt.extend_from_slice(&adv_data[..adv_data.len().min(31)]);
    // CRC placeholder (3 bytes)
    let crc = ble_crc24(&pkt[5..]); // over PDU
    pkt.push((crc & 0xFF) as u8);
    pkt.push(((crc >> 8) & 0xFF) as u8);
    pkt.push(((crc >> 16) & 0xFF) as u8);
    BleAdvPacket { channel, bytes: pkt }
}

pub fn packet_to_symbols(pkt: &BleAdvPacket) -> Vec<u8> {
    pkt.bytes
        .iter()
        .flat_map(|&b| (0..8).map(move |i| (b >> i) & 1))
        .collect()
}

pub fn ble_crc24(data: &[u8]) -> u32 {
    let mut crc: u32 = 0x555555;
    for &byte in data {
        for bit in 0..8 {
            let d = ((byte >> bit) & 1) as u32;
            let msb = (crc >> 23) & 1;
            crc = ((crc << 1) & 0xFFFFFF) | d;
            if msb != 0 {
                crc ^= 0x00065B;
            }
        }
    }
    crc & 0xFFFFFF
}
