//! ERT (Encoder Receiver Transmitter) meter reading — SCM format.

#[derive(Debug, Clone)]
pub struct ErtMessage {
    pub meter_id: u32,
    pub meter_type: u8,
    pub tamper: u8,
    pub consumption: u32,
    pub format: ErtFormat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErtFormat { Scm, ScmPlus }

/// Decode SCM from 96 bits.
pub fn decode_scm(bits: &[bool]) -> Option<ErtMessage> {
    if bits.len() < 96 { return None; }
    let meter_id = extract_u32(bits, 0, 32);
    let meter_type = extract_u32(bits, 32, 4) as u8;
    let tamper = extract_u32(bits, 36, 2) as u8;
    let consumption = extract_u32(bits, 38, 24);
    Some(ErtMessage { meter_id, meter_type, tamper, consumption, format: ErtFormat::Scm })
}

fn extract_u32(bits: &[bool], start: usize, len: usize) -> u32 {
    let mut val = 0u32;
    for i in 0..len.min(32) {
        if start + i < bits.len() && bits[start + i] { val |= 1 << (len - 1 - i); }
    }
    val
}
