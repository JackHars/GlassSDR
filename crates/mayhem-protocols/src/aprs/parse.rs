//! APRS payload parser. Extracts position, status, message from AX.25 info field.
//! Reference: APRS Protocol Reference (APRS101.pdf).

#[derive(Debug, Clone)]
pub enum AprsPacket {
    Position(AprsPosition),
    Status(String),
    Message { addressee: String, text: String, id: Option<String> },
    Other(String),
}

#[derive(Debug, Clone)]
pub struct AprsPosition {
    pub lat: f64,
    pub lon: f64,
    pub symbol_table: char,
    pub symbol_code: char,
    pub comment: String,
}

/// Parse APRS info field (AX.25 payload after PID byte).
pub fn parse_aprs(info: &[u8]) -> AprsPacket {
    if info.is_empty() { return AprsPacket::Other(String::new()); }
    match info[0] as char {
        '!' | '=' => parse_position_uncompressed(info),
        '/' | '@' => parse_position_with_timestamp(info),
        '>' => AprsPacket::Status(String::from_utf8_lossy(&info[1..]).to_string()),
        ':' => parse_message(info),
        _ => AprsPacket::Other(String::from_utf8_lossy(info).to_string()),
    }
}

/// Parse latitude string `DDMM.MMN` -> decimal degrees. 'S' negates.
pub fn parse_lat(s: &str) -> Option<f64> {
    // Format: DDMM.MMN = 8 chars minimum (2 deg + 5 min including dot + 1 hemi)
    if s.len() < 8 {
        return None;
    }
    let (num_part, hemi) = s.split_at(s.len() - 1);
    let deg: f64 = num_part.get(..2)?.parse().ok()?;
    let min: f64 = num_part.get(2..)?.parse().ok()?;
    let mut dec = deg + min / 60.0;
    if hemi.eq_ignore_ascii_case("S") {
        dec = -dec;
    }
    Some(dec)
}

/// Parse longitude string `DDDMM.MMW` -> decimal degrees. 'W' negates.
pub fn parse_lon(s: &str) -> Option<f64> {
    // Format: DDDMM.MMW = 9 chars minimum (3 deg + 5 min including dot + 1 hemi)
    if s.len() < 9 {
        return None;
    }
    let (num_part, hemi) = s.split_at(s.len() - 1);
    let deg: f64 = num_part.get(..3)?.parse().ok()?;
    let min: f64 = num_part.get(3..)?.parse().ok()?;
    let mut dec = deg + min / 60.0;
    if hemi.eq_ignore_ascii_case("W") {
        dec = -dec;
    }
    Some(dec)
}

/// Parse uncompressed position: `!DDMM.MMN/DDDMM.MMW$comment`
/// Data type indicator '!' or '=' at byte 0.
fn parse_position_uncompressed(info: &[u8]) -> AprsPacket {
    parse_position_bytes(&info[1..])
}

/// Parse position with timestamp: `/@DDHHMMzDDMM.MMN/DDDMM.MMW$comment`
/// Data type indicator '/' or '@' at byte 0, timestamp is 7 bytes.
fn parse_position_with_timestamp(info: &[u8]) -> AprsPacket {
    // Skip data type indicator (1) + timestamp (7) = 8 bytes
    if info.len() < 8 {
        return AprsPacket::Other(String::from_utf8_lossy(info).to_string());
    }
    parse_position_bytes(&info[8..])
}

/// Parse position body starting after the data type indicator (and optional timestamp).
/// Format: `DDMM.MMN/DDDMM.MMW$comment`
/// - Bytes 0-7: latitude  (8 chars: DDMM.MMN)
/// - Byte  8:   symbol table ('/' or '\')
/// - Bytes 9-18: longitude (9 chars: DDDMM.MME or DDDMM.MMW — but E/W are at index 18)
///   Actually the longitude field is 9 chars (DDDMM.MM + hemi), so ends at index 17 inclusive.
///   Wait — DDDMM.MMW is 9 chars; indices 9..18 (exclusive) = 9 chars.
/// - Byte  18:  symbol code
/// - Bytes 19+: comment
fn parse_position_bytes(body: &[u8]) -> AprsPacket {
    // Need at least: 8 (lat) + 1 (sym_table) + 9 (lon) + 1 (sym_code) = 19 bytes
    if body.len() < 19 {
        return AprsPacket::Other(String::from_utf8_lossy(body).to_string());
    }
    let lat_str = match std::str::from_utf8(&body[0..8]) {
        Ok(s) => s,
        Err(_) => return AprsPacket::Other(String::from_utf8_lossy(body).to_string()),
    };
    let symbol_table = body[8] as char;
    let lon_str = match std::str::from_utf8(&body[9..18]) {
        Ok(s) => s,
        Err(_) => return AprsPacket::Other(String::from_utf8_lossy(body).to_string()),
    };
    let symbol_code = body[18] as char;
    let comment = String::from_utf8_lossy(&body[19..]).to_string();

    let lat = match parse_lat(lat_str) {
        Some(v) => v,
        None => return AprsPacket::Other(String::from_utf8_lossy(body).to_string()),
    };
    let lon = match parse_lon(lon_str) {
        Some(v) => v,
        None => return AprsPacket::Other(String::from_utf8_lossy(body).to_string()),
    };

    AprsPacket::Position(AprsPosition {
        lat,
        lon,
        symbol_table,
        symbol_code,
        comment,
    })
}

/// Parse APRS message: `:ADDRESSEE :text{id`
/// Format: ':' + 9-char padded addressee + ':' + text (optionally `{id` suffix)
fn parse_message(info: &[u8]) -> AprsPacket {
    // info[0] == ':'
    // Next 9 bytes: addressee (space-padded), then ':', then text
    if info.len() < 11 {
        return AprsPacket::Other(String::from_utf8_lossy(info).to_string());
    }
    let addressee_raw = match std::str::from_utf8(&info[1..10]) {
        Ok(s) => s,
        Err(_) => return AprsPacket::Other(String::from_utf8_lossy(info).to_string()),
    };
    if info[10] != b':' {
        return AprsPacket::Other(String::from_utf8_lossy(info).to_string());
    }
    let addressee = addressee_raw.trim_end().to_string();
    let rest = String::from_utf8_lossy(&info[11..]).to_string();

    // Split off optional message ID: `{id` at end
    let (text, id) = if let Some(brace_pos) = rest.rfind('{') {
        let id_str = rest[brace_pos + 1..].to_string();
        let text_str = rest[..brace_pos].to_string();
        (text_str, Some(id_str))
    } else {
        (rest, None)
    };

    AprsPacket::Message { addressee, text, id }
}
