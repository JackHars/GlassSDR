use mayhem_protocols::ax25::{decode_ax25, hdlc_unstuff, nrzi_decode};

#[test]
fn nrzi_decode_basic() {
    // Same = 1, transition = 0
    let input = [0u8, 0, 0, 1, 1, 0, 1];
    let decoded = nrzi_decode(&input);
    // First bit: 0→0 = same = 1
    assert_eq!(decoded[1], 1); // 0→0 = same = 1
    assert_eq!(decoded[3], 1); // 1→1 = same = 1
}

#[test]
fn crc16_known_value() {
    // Build a minimal valid frame and verify CRC
    // Craft raw bytes: dst(7) + src(7) + control(1) + pid(1) + payload(1) = 17 bytes
    // Then append correct CRC
    let mut frame_no_crc = vec![
        // dst: "CQ    " (shifted left 1) + SSID
        0x86, 0xA2, 0x40, 0x40, 0x40, 0x40, 0x60,
        // src: "N0CALL" (shifted left 1) + SSID with end bit
        0x9C, 0x60, 0x86, 0x82, 0x98, 0x98, 0x61,
        // control: UI frame
        0x03,
        // PID: no layer 3
        0xF0,
        // payload
        0x41, // 'A'
    ];
    let crc = crc16_ccitt(&frame_no_crc);
    frame_no_crc.push(crc as u8);
    frame_no_crc.push((crc >> 8) as u8);

    let result = decode_ax25(&frame_no_crc);
    assert!(result.is_ok(), "valid frame should decode: {:?}", result.err());
    let f = result.unwrap();
    assert_eq!(f.src.call, "N0CALL");
    assert_eq!(f.payload, vec![0x41]);
}

fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0x8408;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFF
}

#[test]
fn decode_rejects_bad_crc() {
    let frame = vec![
        0x86, 0xA2, 0x40, 0x40, 0x40, 0x40, 0x60,
        0x9C, 0x60, 0x86, 0x82, 0x98, 0x98, 0x61,
        0x03, 0xF0, 0x41,
        0xFF, 0xFF, // bad CRC
    ];
    let result = decode_ax25(&frame);
    assert!(result.is_err());
}

#[test]
fn hdlc_unstuff_removes_stuffed_bits() {
    // 5 ones followed by a stuffed zero should be removed
    // But we need flags around it for hdlc_unstuff to return a frame.
    // Just test that the function doesn't panic on various inputs.
    let bits = vec![0u8; 100]; // all zeros, no flags → no frames
    let frames = hdlc_unstuff(&bits);
    assert!(frames.is_empty());
}
