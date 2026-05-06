use mayhem_protocols::ert::{decode_scm, ErtFormat};
use mayhem_protocols::weather::{decode_oregon_v2, WeatherData};
use mayhem_protocols::sonde::{decode_rs41_frame, SondeType};
use mayhem_protocols::flex::decode_flex_frame;

#[test]
fn ert_decode_basic() {
    let mut bits = vec![false; 96];
    // Set meter_id = 1 (bit 31 of first 32 bits)
    bits[31] = true;
    let msg = decode_scm(&bits).unwrap();
    assert_eq!(msg.meter_id, 1);
    assert_eq!(msg.format, ErtFormat::Scm);
}

#[test]
fn ert_too_short() {
    assert!(decode_scm(&vec![false; 50]).is_none());
}

#[test]
fn oregon_temp_humidity() {
    // Sensor 0x1D20, channel 1, temp=23.5C, humidity=45%
    let nibbles = [0x1, 0xD, 0x2, 0x0, 0x1, 0x0, 0x0, 0x00,
                   0x5, 0x3, 0x2, 0x0, 0x4, 0x5, 0x0, 0x0];
    let reading = decode_oregon_v2(&nibbles).unwrap();
    assert_eq!(reading.sensor_id, 0x1D20);
    assert_eq!(reading.channel, 1);
    match reading.data {
        WeatherData::TempHumidity { celsius, humidity } => {
            assert!((celsius - 23.5).abs() < 0.1);
            assert_eq!(humidity, 45);
        }
        _ => panic!("expected TempHumidity"),
    }
}

#[test]
fn rs41_header_check() {
    let mut frame = vec![0u8; 320];
    frame[0..8].copy_from_slice(&[0x86, 0x35, 0xF4, 0x40, 0x93, 0xDF, 0x1A, 0x60]);
    frame[9..13].copy_from_slice(b"R341");
    let tel = decode_rs41_frame(&frame).unwrap();
    assert!(tel.serial.contains("R341"));
    assert_eq!(tel.sonde_type, SondeType::Rs41);
}

#[test]
fn rs41_bad_header() {
    let frame = vec![0u8; 320]; // wrong header
    assert!(decode_rs41_frame(&frame).is_none());
}

#[test]
fn flex_too_short() {
    assert!(decode_flex_frame(&vec![0u8; 100]).is_empty());
}
