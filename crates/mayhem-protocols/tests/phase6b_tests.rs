//! Phase 6b integration tests: BLE, NRF24, Flipper, Keyfob, LGE encoders.

// ── BLE CRC ──────────────────────────────────────────────────────────────────

#[test]
fn ble_crc24_known_value() {
    use mayhem_protocols::ble::ble_crc24;
    // CRC of empty slice with init 0x555555 should be 0x555555
    let crc = ble_crc24(&[]);
    assert_eq!(crc, 0x555555);
}

#[test]
fn ble_crc24_deterministic() {
    use mayhem_protocols::ble::ble_crc24;
    let data = b"\x02\x08\x01\x02\x03\x04\x05\x06";
    let crc1 = ble_crc24(data);
    let crc2 = ble_crc24(data);
    assert_eq!(crc1, crc2, "CRC must be deterministic");
}

#[test]
fn ble_crc24_differs_on_different_data() {
    use mayhem_protocols::ble::ble_crc24;
    let crc_a = ble_crc24(b"hello");
    let crc_b = ble_crc24(b"world");
    assert_ne!(crc_a, crc_b, "CRC should differ for different inputs");
}

#[test]
fn ble_build_adv_packet_channel() {
    use mayhem_protocols::ble::build_adv_packet;
    let addr = [0x01u8, 0x02, 0x03, 0x04, 0x05, 0x06];
    let pkt = build_adv_packet(&addr, b"\x02\x01\x06", 37);
    assert_eq!(pkt.channel, 37);
}

#[test]
fn ble_adv_packet_starts_with_preamble_and_access_addr() {
    use mayhem_protocols::ble::build_adv_packet;
    let addr = [0xAAu8, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
    let pkt = build_adv_packet(&addr, b"", 38);
    assert_eq!(pkt.bytes[0], 0xAA, "preamble must be 0xAA");
    assert_eq!(&pkt.bytes[1..5], &[0xD6, 0xBE, 0x89, 0x8E], "access address must match LE advertising");
}

#[test]
fn ble_adv_data_clamped_to_31_bytes() {
    use mayhem_protocols::ble::build_adv_packet;
    let addr = [0u8; 6];
    let long_data = vec![0xAAu8; 64];
    let pkt = build_adv_packet(&addr, &long_data, 39);
    // PDU length field at byte 6: 6 (addr) + min(64, 31) = 37
    assert_eq!(pkt.bytes[6], 37u8, "PDU length should clamp adv_data to 31 bytes");
}

#[test]
fn ble_packet_to_symbols_length() {
    use mayhem_protocols::ble::{build_adv_packet, packet_to_symbols};
    let addr = [0u8; 6];
    let pkt = build_adv_packet(&addr, b"\x02\x01\x06", 37);
    let symbols = packet_to_symbols(&pkt);
    assert_eq!(symbols.len(), pkt.bytes.len() * 8);
}

// ── NRF24 CRC ────────────────────────────────────────────────────────────────

#[test]
fn nrf24_crc16_known_value() {
    use mayhem_protocols::nrf24::nrf_crc16;
    // CRC-16/CCITT-FALSE of empty slice = 0xFFFF
    let crc = nrf_crc16(&[]);
    assert_eq!(crc, 0xFFFF);
}

#[test]
fn nrf24_crc16_deterministic() {
    use mayhem_protocols::nrf24::nrf_crc16;
    let data = b"\xE7\xE7\xE7\xE7\xE7\x14\x00HELLO";
    let crc1 = nrf_crc16(data);
    let crc2 = nrf_crc16(data);
    assert_eq!(crc1, crc2);
}

#[test]
fn nrf24_build_shockburst_non_empty() {
    use mayhem_protocols::nrf24::build_shockburst;
    let addr = [0xE7u8; 5];
    let pkt = build_shockburst(&addr, b"TEST");
    assert!(!pkt.bytes.is_empty());
}

#[test]
fn nrf24_build_shockburst_preamble_0xAA_for_low_msb_addr() {
    use mayhem_protocols::nrf24::build_shockburst;
    // Address MSB bit7 = 0 → preamble = 0xAA
    let addr = [0x01u8, 0x02, 0x03, 0x04, 0x05];
    let pkt = build_shockburst(&addr, b"HI");
    assert_eq!(pkt.bytes[0], 0xAA);
}

#[test]
fn nrf24_build_shockburst_preamble_0x55_for_high_msb_addr() {
    use mayhem_protocols::nrf24::build_shockburst;
    // Address MSB bit7 = 1 → preamble = 0x55
    let addr = [0xE7u8, 0xE7, 0xE7, 0xE7, 0xE7];
    let pkt = build_shockburst(&addr, b"HI");
    assert_eq!(pkt.bytes[0], 0x55);
}

#[test]
fn nrf24_packet_to_symbols_msb_first() {
    use mayhem_protocols::nrf24::{build_shockburst, packet_to_symbols};
    let addr = [0x01u8; 5];
    let pkt = build_shockburst(&addr, b"X");
    let symbols = packet_to_symbols(&pkt);
    // First byte = 0xAA = 0b10101010, MSB first → [1,0,1,0,1,0,1,0]
    assert_eq!(&symbols[..8], &[1u8, 0, 1, 0, 1, 0, 1, 0]);
}

// ── Flipper .sub Parser ───────────────────────────────────────────────────────

#[test]
fn flipper_parse_sub_file_basic() {
    use mayhem_protocols::flipper::parse_sub_file;
    let content = "Frequency: 433920000\nRAW_Data: 500 -500 500 -500\n";
    let sub = parse_sub_file(content).expect("should parse");
    assert!((sub.frequency - 433920000.0).abs() < 1.0);
    assert_eq!(sub.raw_data, vec![500, -500, 500, -500]);
}

#[test]
fn flipper_parse_sub_file_returns_none_on_empty() {
    use mayhem_protocols::flipper::parse_sub_file;
    let result = parse_sub_file("");
    assert!(result.is_none());
}

#[test]
fn flipper_parse_sub_file_returns_none_without_raw_data() {
    use mayhem_protocols::flipper::parse_sub_file;
    let content = "Frequency: 433920000\n";
    let result = parse_sub_file(content);
    assert!(result.is_none(), "missing RAW_Data should return None");
}

#[test]
fn flipper_sub_to_baseband_correct_length() {
    use mayhem_protocols::flipper::{parse_sub_file, sub_to_baseband};
    let content = "Frequency: 433920000\nRAW_Data: 1000 -1000\n";
    let sub = parse_sub_file(content).unwrap();
    // 1000 µs high + 1000 µs low at 250_000 sps = 250 + 250 = 500 samples
    let bb = sub_to_baseband(&sub, 250_000.0);
    assert_eq!(bb.len(), 500);
}

#[test]
fn flipper_sub_to_baseband_levels() {
    use mayhem_protocols::flipper::{parse_sub_file, sub_to_baseband};
    let content = "Frequency: 433920000\nRAW_Data: 1000 -1000\n";
    let sub = parse_sub_file(content).unwrap();
    let bb = sub_to_baseband(&sub, 250_000.0);
    assert!(bb[..250].iter().all(|&s| s == 1), "positive duration → high samples");
    assert!(bb[250..].iter().all(|&s| s == 0), "negative duration → low samples");
}

// ── Keyfob Encoder ───────────────────────────────────────────────────────────

#[test]
fn keyfob_encode_pt2262_pulse_count() {
    use mayhem_protocols::keyfob::encode_pt2262;
    // 1 repeat: 1 sync + 24 data bits = 25 pulses
    let pulses = encode_pt2262(0xABCDE, 24, 1);
    assert_eq!(pulses.len(), 25);
}

#[test]
fn keyfob_encode_pt2262_multiple_repeats() {
    use mayhem_protocols::keyfob::encode_pt2262;
    let pulses = encode_pt2262(0xABCDE, 24, 3);
    assert_eq!(pulses.len(), 75, "3 repeats × 25 pulses");
}

#[test]
fn keyfob_encode_pt2262_sync_pulse() {
    use mayhem_protocols::keyfob::encode_pt2262;
    let pulses = encode_pt2262(0x000000, 24, 1);
    // First pulse is sync: (350, 10850)
    assert_eq!(pulses[0], (350, 10850));
}

#[test]
fn keyfob_pulses_to_baseband_non_empty() {
    use mayhem_protocols::keyfob::{encode_pt2262, pulses_to_baseband};
    let pulses = encode_pt2262(0xABCDE, 24, 1);
    let bb = pulses_to_baseband(&pulses, 250_000.0);
    assert!(!bb.is_empty());
}

// ── LGE Encoder ──────────────────────────────────────────────────────────────

#[test]
fn lge_encode_total_bit_length() {
    use mayhem_protocols::lge::encode_lge;
    // 16 preamble + 8 addr + 8 cmd + 8 checksum = 40 bits
    let bits = encode_lge(0x01, 0x42);
    assert_eq!(bits.len(), 40);
}

#[test]
fn lge_encode_preamble_alternates() {
    use mayhem_protocols::lge::encode_lge;
    let bits = encode_lge(0xAB, 0xCD);
    for i in 0..16 {
        assert_eq!(bits[i], (i % 2) as u8, "preamble bit {} wrong", i);
    }
}

#[test]
fn lge_encode_checksum_is_xor() {
    use mayhem_protocols::lge::encode_lge;
    let device_addr = 0xA5u8;
    let command = 0x5Au8;
    let expected_chk = device_addr ^ command; // = 0xFF
    let bits = encode_lge(device_addr, command);
    // Last 8 bits = checksum
    let chk_bits: Vec<u8> = bits[32..40].to_vec();
    let chk: u8 = chk_bits
        .iter()
        .enumerate()
        .map(|(i, &b)| b << (7 - i))
        .sum();
    assert_eq!(chk, expected_chk);
}

#[test]
fn lge_encode_all_bits_are_0_or_1() {
    use mayhem_protocols::lge::encode_lge;
    let bits = encode_lge(0xFF, 0x00);
    assert!(bits.iter().all(|&b| b == 0 || b == 1), "all bits must be 0 or 1");
}
