//! Phase 6a integration tests: ADS-B TX encoder and MDC-1200 encoder.
//! Frequency policy tests live in mayhem-radio's own unit tests (freq_policy.rs).

// ── ADS-B TX Encoder ─────────────────────────────────────────────────────────

#[test]
fn adsb_frame_length_is_14_bytes() {
    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position};
    let p = AdsbTxEncParams { icao24: 0xABCDEF, lat: 51.5, lon: -0.12, alt_ft: 35000 };
    let frame = encode_adsb_position(&p);
    assert_eq!(frame.len(), 14);
}

#[test]
fn adsb_frame_df17_byte() {
    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position};
    let p = AdsbTxEncParams { icao24: 0x4840D6, lat: 48.0, lon: 2.0, alt_ft: 10000 };
    let frame = encode_adsb_position(&p);
    // Byte 0 must be 0x8D (DF=17, CA=5)
    assert_eq!(frame[0], 0x8D);
}

#[test]
fn adsb_icao24_encoded_in_bytes_1_to_3() {
    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position};
    let icao24 = 0x123456u32;
    let p = AdsbTxEncParams { icao24, lat: 0.0, lon: 0.0, alt_ft: 0 };
    let frame = encode_adsb_position(&p);
    assert_eq!(frame[1], 0x12);
    assert_eq!(frame[2], 0x34);
    assert_eq!(frame[3], 0x56);
}

#[test]
fn adsb_ppm_preamble_correct() {
    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position, adsb_to_ppm};
    let p = AdsbTxEncParams { icao24: 0xABCDEF, lat: 0.0, lon: 0.0, alt_ft: 0 };
    let frame = encode_adsb_position(&p);
    let ppm = adsb_to_ppm(&frame);
    // Preamble: 1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0 (16 symbols)
    assert_eq!(&ppm[..16], &[1u8, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
}

#[test]
fn adsb_ppm_total_length() {
    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position, adsb_to_ppm};
    let p = AdsbTxEncParams { icao24: 0xABCDEF, lat: 0.0, lon: 0.0, alt_ft: 0 };
    let frame = encode_adsb_position(&p);
    let ppm = adsb_to_ppm(&frame);
    // 16 preamble + 14 bytes * 8 bits * 2 PPM symbols = 16 + 224 = 240
    assert_eq!(ppm.len(), 240);
}

// ── MDC-1200 Encoder ─────────────────────────────────────────────────────────

#[test]
fn mdc1200_encode_non_empty() {
    use mayhem_protocols::mdc1200::{Mdc1200Packet, encode_mdc1200};
    let pkt = Mdc1200Packet { unit_id: 0x1234, opcode: 0x01 };
    let bits = encode_mdc1200(&pkt);
    assert!(!bits.is_empty(), "encoded MDC-1200 packet should not be empty");
}

#[test]
fn mdc1200_encode_starts_with_preamble() {
    use mayhem_protocols::mdc1200::{Mdc1200Packet, encode_mdc1200};
    let pkt = Mdc1200Packet { unit_id: 0x0000, opcode: 0x00 };
    let bits = encode_mdc1200(&pkt);
    // First 40 bits are preamble: alternating 0,1,0,1,...
    for i in 0..40 {
        assert_eq!(bits[i], (i % 2) as u8, "preamble bit {} wrong", i);
    }
}

#[test]
fn mdc1200_encode_has_sync_word() {
    use mayhem_protocols::mdc1200::{Mdc1200Packet, encode_mdc1200};
    let pkt = Mdc1200Packet { unit_id: 0xFFFF, opcode: 0xFF };
    let bits = encode_mdc1200(&pkt);
    // After 40-bit preamble: sync is [0,0,0,0,0,1,1,1, 0,0,0,0,1,0,0,1]
    let expected_sync: &[u8] = &[0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1];
    assert_eq!(&bits[40..56], expected_sync);
}

#[test]
fn mdc1200_encode_total_bit_length() {
    use mayhem_protocols::mdc1200::{Mdc1200Packet, encode_mdc1200};
    let pkt = Mdc1200Packet { unit_id: 0x5A5A, opcode: 0x0F };
    let bits = encode_mdc1200(&pkt);
    // 40 preamble + 16 sync + 8 opcode + 16 unit_id + 8 checksum = 88 bits
    assert_eq!(bits.len(), 88);
}
