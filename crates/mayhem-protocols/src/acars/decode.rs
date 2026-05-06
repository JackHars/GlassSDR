//! ACARS (Aircraft Communications Addressing and Reporting System) frame decoder.
//! Extracts mode, registration, label, flight number, and text from raw bytes.

#[derive(Debug, Clone)]
pub struct AcarsMessage {
    pub mode: char,
    pub reg: String,        // Aircraft registration (7 chars, trimmed)
    pub ack: char,
    pub label: String,      // 2-char message label
    pub block_id: char,
    pub flight: String,     // Flight number (up to 6 chars)
    pub text: String,       // Message text
}

/// Decode ACARS frame from raw bytes (after sync detection + parity strip).
/// Minimum frame: mode(1) + reg(7) + ack(1) + label(2) + block_id(1) = 12 bytes.
pub fn decode_acars(data: &[u8]) -> Option<AcarsMessage> {
    if data.len() < 12 { return None; }

    let mode = (data[0] & 0x7F) as char;
    let reg: String = data[1..8].iter()
        .map(|&b| (b & 0x7F) as char)
        .collect::<String>()
        .trim()
        .to_string();
    let ack = (data[8] & 0x7F) as char;
    let label = data[9..11].iter()
        .map(|&b| (b & 0x7F) as char)
        .collect::<String>();
    let block_id = (data[11] & 0x7F) as char;

    // Text portion starts at byte 12, ends at ETX (0x03) or ETB (0x17)
    let text_end = data[12..].iter()
        .position(|&b| (b & 0x7F) == 0x03 || (b & 0x7F) == 0x17)
        .map(|p| p + 12)
        .unwrap_or(data.len());

    let raw_text = &data[12..text_end];

    // First 4 chars of text = message number, next 6 = flight ID
    let (flight, text) = if raw_text.len() >= 10 {
        let flight: String = raw_text[4..10].iter()
            .map(|&b| (b & 0x7F) as char)
            .collect::<String>()
            .trim()
            .to_string();
        let text: String = raw_text[10..].iter()
            .map(|&b| (b & 0x7F) as char)
            .collect();
        (flight, text)
    } else {
        let text: String = raw_text.iter()
            .map(|&b| (b & 0x7F) as char)
            .collect();
        (String::new(), text)
    };

    Some(AcarsMessage { mode, reg, ack, label, block_id, flight, text })
}
