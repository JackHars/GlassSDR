use mayhem_protocols::ais::{decode_ais, AisMessage};

/// Convert AIVDM 6-bit ASCII payload to bit vector.
fn aivdm_to_bits(payload: &str) -> Vec<bool> {
    let mut bits = Vec::new();
    for ch in payload.bytes() {
        let mut val = ch - 48;
        if val > 40 { val -= 8; }
        for i in (0..6).rev() {
            bits.push((val >> i) & 1 == 1);
        }
    }
    bits
}

#[test]
fn decode_type1_position_report() {
    // Real AIS message: !AIVDM,1,1,,B,13u@Dt002s000000000000000000,0*25
    // Payload: "13u@Dt002s000000000000000000"
    let bits = aivdm_to_bits("13u@Dt002s000000000000000000");
    let msg = decode_ais(&bits);
    assert!(msg.is_some());
    match msg.unwrap() {
        AisMessage::PositionReport(pos) => {
            assert_eq!(pos.mmsi & 0x3FFFFFFF, pos.mmsi); // 30-bit MMSI
            // Speed = 18.7 knots (decoded from payload)
            assert_eq!(pos.speed_knots, 18.7);
        }
        other => panic!("expected PositionReport, got {:?}", other),
    }
}

#[test]
fn decode_type5_static() {
    // Minimal type 5 — 424 bits needed. Create synthetic.
    let mut bits = vec![false; 424];
    // msg_type = 5 = 000101 (MSB first: bit3=1, bit5=1)
    bits[3] = true; bits[5] = true;
    // MMSI at bits 8-37 = 123456789 (but only 30 bits)
    let mmsi: u32 = 123456789;
    for i in 0..30 {
        bits[8 + i] = (mmsi >> (29 - i)) & 1 == 1;
    }
    // ship_type at bits 232-239 = 70 (cargo)
    let st: u8 = 70;
    for i in 0..8 {
        bits[232 + i] = (st >> (7 - i)) & 1 == 1;
    }

    let msg = decode_ais(&bits);
    assert!(msg.is_some());
    match msg.unwrap() {
        AisMessage::StaticVoyage(s) => {
            assert_eq!(s.mmsi, 123456789);
            assert_eq!(s.ship_type, 70);
        }
        other => panic!("expected StaticVoyage, got {:?}", other),
    }
}

#[test]
fn decode_too_short_returns_none() {
    let bits = vec![false; 10];
    assert!(decode_ais(&bits).is_none());
}

#[test]
fn decode_unknown_type() {
    // Type 27 (long-range) — not decoded, returns Unknown
    let mut bits = vec![false; 168];
    // msg_type = 27 = 011011
    bits[1] = true; bits[2] = true; bits[4] = true; bits[5] = true;
    match decode_ais(&bits) {
        Some(AisMessage::Unknown { msg_type }) => assert_eq!(msg_type, 27),
        other => panic!("expected Unknown, got {:?}", other),
    }
}
