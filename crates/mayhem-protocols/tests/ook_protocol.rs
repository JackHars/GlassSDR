//! Integration tests for OOK protocol decoders.

use mayhem_protocols::ook::decode_tpms_schrader;

/// Build a 64-bit test vector for a Schrader TPMS frame:
///   bits[0..32]  = sensor_id  = 0xDEAD_BEEF
///   bits[32..40] = pressure_raw = 100  → 100 * 2.5 = 250.0 kPa
///   bits[40..48] = temp_raw    = 93   → 93 - 50 = 43.0 °C
///   bits[48..64] = padding zeros
fn make_tpms_bits(sensor_id: u32, pressure_raw: u8, temp_raw: u8) -> Vec<bool> {
    let mut bits = Vec::with_capacity(64);
    // sensor_id — MSB first
    for i in (0..32).rev() {
        bits.push((sensor_id >> i) & 1 == 1);
    }
    // pressure_raw — 8 bits MSB first
    for i in (0..8).rev() {
        bits.push((pressure_raw >> i) & 1 == 1);
    }
    // temp_raw — 8 bits MSB first
    for i in (0..8).rev() {
        bits.push((temp_raw >> i) & 1 == 1);
    }
    // padding zeros to reach 64 bits
    while bits.len() < 64 {
        bits.push(false);
    }
    bits
}

#[test]
fn tpms_schrader_decode_known_vector() {
    let bits = make_tpms_bits(0xDEAD_BEEF, 100, 93);
    let sensor = decode_tpms_schrader(&bits).expect("decode should succeed");

    assert_eq!(sensor.sensor_id, 0xDEAD_BEEF);
    assert!((sensor.pressure_kpa - 250.0).abs() < 0.01, "pressure_kpa = {}", sensor.pressure_kpa);
    assert!((sensor.temperature_c - 43.0).abs() < 0.01, "temperature_c = {}", sensor.temperature_c);
}

#[test]
fn tpms_schrader_rejects_short_input() {
    let bits = vec![true; 32]; // only 32 bits — too short
    assert!(decode_tpms_schrader(&bits).is_none());
}

#[test]
fn tpms_schrader_zero_vector() {
    let bits = vec![false; 64];
    let sensor = decode_tpms_schrader(&bits).expect("all-zero is valid frame");
    assert_eq!(sensor.sensor_id, 0);
    assert!((sensor.pressure_kpa - 0.0).abs() < 0.01);
    assert!((sensor.temperature_c - (-50.0)).abs() < 0.01);
}

#[test]
fn tpms_schrader_all_ones() {
    let bits = vec![true; 64];
    let sensor = decode_tpms_schrader(&bits).expect("all-ones is valid frame");
    // sensor_id = 0xFFFF_FFFF
    assert_eq!(sensor.sensor_id, 0xFFFF_FFFF);
    // pressure_raw = 0xFF = 255, * 2.5 = 637.5
    assert!((sensor.pressure_kpa - 637.5).abs() < 0.01, "pressure_kpa = {}", sensor.pressure_kpa);
    // temp_raw = 0xFF = 255, - 50 = 205
    assert!((sensor.temperature_c - 205.0).abs() < 0.01, "temperature_c = {}", sensor.temperature_c);
}

#[test]
fn tpms_schrader_exact_64_bits_accepted() {
    // Boundary: exactly 64 bits should be accepted.
    let bits = make_tpms_bits(0x1234_5678, 80, 70);
    assert_eq!(bits.len(), 64);
    let sensor = decode_tpms_schrader(&bits).unwrap();
    assert_eq!(sensor.sensor_id, 0x1234_5678);
    assert!((sensor.pressure_kpa - 80.0 * 2.5).abs() < 0.01);
    assert!((sensor.temperature_c - (70.0 - 50.0)).abs() < 0.01);
}
