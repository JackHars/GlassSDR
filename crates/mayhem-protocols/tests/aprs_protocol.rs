use mayhem_protocols::aprs::{parse_aprs, AprsPacket, AprsPosition};

#[test]
fn parse_uncompressed_position() {
    // !4903.50N/07201.75W-PHG2360
    let info = b"!4903.50N/07201.75W-PHG2360";
    match parse_aprs(info) {
        AprsPacket::Position(pos) => {
            assert!((pos.lat - 49.0583333).abs() < 0.001, "lat={}", pos.lat);
            assert!((pos.lon - (-72.0291667)).abs() < 0.001, "lon={}", pos.lon);
            assert_eq!(pos.symbol_table, '/');
            assert_eq!(pos.symbol_code, '-');
        }
        other => panic!("expected Position, got {:?}", other),
    }
}

#[test]
fn parse_status() {
    let info = b">Net Control - Loss Angeles";
    match parse_aprs(info) {
        AprsPacket::Status(s) => assert_eq!(s, "Net Control - Loss Angeles"),
        other => panic!("expected Status, got {:?}", other),
    }
}

#[test]
fn parse_message() {
    let info = b":BLN1     :Weather bulletin{001";
    match parse_aprs(info) {
        AprsPacket::Message { addressee, text, id } => {
            assert_eq!(addressee, "BLN1");
            assert_eq!(text, "Weather bulletin");
            assert_eq!(id, Some("001".to_string()));
        }
        other => panic!("expected Message, got {:?}", other),
    }
}

#[test]
fn parse_with_timestamp() {
    let info = b"/092345z4903.50N/07201.75W>comment";
    match parse_aprs(info) {
        AprsPacket::Position(pos) => {
            assert!((pos.lat - 49.0583333).abs() < 0.001);
            assert!((pos.lon - (-72.0291667)).abs() < 0.001);
        }
        other => panic!("expected Position, got {:?}", other),
    }
}
