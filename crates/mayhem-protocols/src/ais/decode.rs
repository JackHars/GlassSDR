//! AIS message decoder. Decodes from bit vector (after 6-bit ASCII → binary).

#[derive(Debug, Clone)]
pub enum AisMessage {
    PositionReport(AisPosition),   // Types 1, 2, 3
    StaticVoyage(AisStatic),       // Type 5
    Unknown { msg_type: u8 },
}

#[derive(Debug, Clone)]
pub struct AisPosition {
    pub mmsi: u32,
    pub status: u8,
    pub speed_knots: f64,    // 0.1 knot resolution
    pub lon: f64,            // degrees
    pub lat: f64,            // degrees
    pub course: f64,         // 0.1 degree resolution
    pub heading: u16,        // degrees (511 = not available)
    pub timestamp: u8,       // second of UTC minute
}

#[derive(Debug, Clone)]
pub struct AisStatic {
    pub mmsi: u32,
    pub imo: u32,
    pub callsign: String,
    pub name: String,
    pub ship_type: u8,
    pub destination: String,
}

/// Decode AIS message from bit vector.
pub fn decode_ais(bits: &[bool]) -> Option<AisMessage> {
    if bits.len() < 38 { return None; }
    let msg_type = extract_uint(bits, 0, 6) as u8;
    let mmsi = extract_uint(bits, 8, 30) as u32;

    match msg_type {
        1 | 2 | 3 => decode_position(bits, mmsi),
        5 => decode_static(bits, mmsi),
        _ => Some(AisMessage::Unknown { msg_type }),
    }
}

fn decode_position(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 168 { return None; }
    let status = extract_uint(bits, 38, 4) as u8;
    let speed_raw = extract_uint(bits, 50, 10);
    let lon_raw = extract_int(bits, 61, 28);
    let lat_raw = extract_int(bits, 89, 27);
    let course_raw = extract_uint(bits, 116, 12);
    let heading = extract_uint(bits, 128, 9) as u16;
    let timestamp = extract_uint(bits, 137, 6) as u8;

    Some(AisMessage::PositionReport(AisPosition {
        mmsi,
        status,
        speed_knots: speed_raw as f64 / 10.0,
        lon: lon_raw as f64 / 600000.0,
        lat: lat_raw as f64 / 600000.0,
        course: course_raw as f64 / 10.0,
        heading,
        timestamp,
    }))
}

fn decode_static(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 424 { return None; }
    let imo = extract_uint(bits, 40, 30) as u32;
    let callsign = extract_string(bits, 70, 42);
    let name = extract_string(bits, 112, 120);
    let ship_type = extract_uint(bits, 232, 8) as u8;
    let destination = extract_string(bits, 302, 120);

    Some(AisMessage::StaticVoyage(AisStatic {
        mmsi, imo, callsign, name, ship_type, destination,
    }))
}

fn extract_uint(bits: &[bool], start: usize, len: usize) -> u64 {
    let mut val = 0u64;
    for i in 0..len {
        if start + i < bits.len() && bits[start + i] {
            val |= 1 << (len - 1 - i);
        }
    }
    val
}

fn extract_int(bits: &[bool], start: usize, len: usize) -> i64 {
    let val = extract_uint(bits, start, len);
    if val & (1 << (len - 1)) != 0 {
        val as i64 | (!0i64 << len)
    } else {
        val as i64
    }
}

fn extract_string(bits: &[bool], start: usize, bit_len: usize) -> String {
    let mut s = String::new();
    for i in (0..bit_len).step_by(6) {
        let ch = extract_uint(bits, start + i, 6) as u8;
        let ascii = if ch < 32 { ch + 64 } else { ch };
        if ascii == b'@' { break; }
        s.push(ascii as char);
    }
    s.trim().to_string()
}
