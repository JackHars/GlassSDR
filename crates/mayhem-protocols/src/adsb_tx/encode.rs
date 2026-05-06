pub struct AdsbTxParams {
    pub icao24: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: i32,
}

/// Encode ADS-B position to 14 bytes.
pub fn encode_adsb_position(p: &AdsbTxParams) -> [u8; 14] {
    let mut frame = [0u8; 14];
    frame[0] = 0x8D; // DF17 + CA5
    frame[1] = (p.icao24 >> 16) as u8;
    frame[2] = (p.icao24 >> 8) as u8;
    frame[3] = p.icao24 as u8;
    // TC=11 (airborne position) in ME field
    frame[4] = 11 << 3;
    // Simplified altitude + position encoding (stub — full CPR is complex)
    let alt_code = ((p.alt_ft + 1000).max(0) / 25) as u16;
    frame[5] = (alt_code >> 4) as u8;
    frame[6] = ((alt_code & 0x0F) as u8) << 4;
    // CRC-24 over bytes 0-10
    let crc = crc24(&frame[0..11]);
    frame[11] = (crc >> 16) as u8;
    frame[12] = (crc >> 8) as u8;
    frame[13] = crc as u8;
    frame
}

/// Convert frame to PPM symbols for OOK transmission.
pub fn adsb_to_ppm(frame: &[u8; 14]) -> Vec<u8> {
    let mut ppm = vec![1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]; // 8µs preamble
    for &byte in frame {
        for i in (0..8).rev() {
            let b = (byte >> i) & 1;
            if b == 1 {
                ppm.push(1);
                ppm.push(0);
            } else {
                ppm.push(0);
                ppm.push(1);
            }
        }
    }
    ppm
}

fn crc24(data: &[u8]) -> u32 {
    let mut crc = 0u32;
    for &byte in data {
        crc ^= (byte as u32) << 16;
        for _ in 0..8 {
            if crc & 0x800000 != 0 {
                crc = (crc << 1) ^ 0xFFF409;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFFFF;
        }
    }
    crc
}
