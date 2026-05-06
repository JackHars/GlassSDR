//! LGE appliance protocol encoder (stub).

pub fn encode_lge(device_addr: u8, command: u8) -> Vec<u8> {
    let mut bits = Vec::new();
    for i in 0..16 {
        bits.push((i % 2) as u8);
    } // preamble
    for i in (0..8).rev() {
        bits.push((device_addr >> i) & 1);
    }
    for i in (0..8).rev() {
        bits.push((command >> i) & 1);
    }
    let chk = device_addr ^ command;
    for i in (0..8).rev() {
        bits.push((chk >> i) & 1);
    }
    bits
}
