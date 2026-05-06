//! TPMS (Tire Pressure Monitoring) decoder for common formats.

#[derive(Debug, Clone)]
pub struct TpmsSensor {
    pub sensor_id: u32,
    pub pressure_kpa: f32,
    pub temperature_c: f32,
}

/// Decode Schrader TPMS from Manchester-decoded bits (typically 64 bits).
pub fn decode_tpms_schrader(bits: &[bool]) -> Option<TpmsSensor> {
    if bits.len() < 64 {
        return None;
    }
    let sensor_id = extract_u32(bits, 0, 32);
    let pressure_raw = extract_u32(bits, 32, 8) as f32;
    let temp_raw = extract_u32(bits, 40, 8) as f32;
    Some(TpmsSensor {
        sensor_id,
        pressure_kpa: pressure_raw * 2.5, // typical scaling
        temperature_c: temp_raw - 50.0,   // offset
    })
}

fn extract_u32(bits: &[bool], start: usize, len: usize) -> u32 {
    let mut val = 0u32;
    for i in 0..len.min(32) {
        if start + i < bits.len() && bits[start + i] {
            val |= 1 << (len - 1 - i);
        }
    }
    val
}
