//! Vaisala RS41 radiosonde frame decoder (simplified).

#[derive(Debug, Clone)]
pub struct SondeTelemetry {
    pub serial: String,
    pub frame_number: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt_m: f64,
    pub sonde_type: SondeType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SondeType { Rs41, M10, Dfm }

const RS41_HEADER: [u8; 8] = [0x86, 0x35, 0xF4, 0x40, 0x93, 0xDF, 0x1A, 0x60];

/// Decode RS41 frame from raw bytes (after FSK demod + byte sync).
pub fn decode_rs41_frame(frame: &[u8]) -> Option<SondeTelemetry> {
    if frame.len() < 320 { return None; }
    if &frame[0..8] != &RS41_HEADER { return None; }

    // Serial: bytes 9-17 ASCII (after XOR descramble — simplified: assume already descrambled)
    let serial: String = frame[9..17].iter()
        .filter(|&&b| b.is_ascii_alphanumeric())
        .map(|&b| b as char)
        .collect();

    let frame_number = u16::from_le_bytes([frame[17], frame[18]]) as u32;

    // GPS position would be in subframes — stub with zeros for now
    Some(SondeTelemetry {
        serial,
        frame_number,
        lat: 0.0, lon: 0.0, alt_m: 0.0,
        sonde_type: SondeType::Rs41,
    })
}
