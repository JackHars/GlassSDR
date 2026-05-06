//! Oregon Scientific v2.1 weather sensor decoder.

#[derive(Debug, Clone)]
pub struct WeatherReading {
    pub sensor_id: u16,
    pub channel: u8,
    pub battery_low: bool,
    pub data: WeatherData,
}

#[derive(Debug, Clone)]
pub enum WeatherData {
    Temperature { celsius: f32 },
    TempHumidity { celsius: f32, humidity: u8 },
}

/// Decode Oregon Scientific v2.1 from nibbles (4 bits each, already decoded).
pub fn decode_oregon_v2(nibbles: &[u8]) -> Option<WeatherReading> {
    if nibbles.len() < 16 { return None; }
    let sensor_id = (nibbles[0] as u16) << 12 | (nibbles[1] as u16) << 8
        | (nibbles[2] as u16) << 4 | nibbles[3] as u16;
    let channel = nibbles[4] & 0x0F;
    let battery_low = nibbles[7] & 0x04 != 0;

    // Temperature: nibbles 8-11 as BCD with sign in nibble 11 bit 3
    let sign = if nibbles[11] & 0x08 != 0 { -1.0 } else { 1.0 };
    let temp = sign * (nibbles[10] as f32 * 10.0 + nibbles[9] as f32 + nibbles[8] as f32 * 0.1);

    let data = if nibbles.len() >= 14 {
        let humidity = nibbles[12] * 10 + nibbles[13];
        WeatherData::TempHumidity { celsius: temp, humidity }
    } else {
        WeatherData::Temperature { celsius: temp }
    };

    Some(WeatherReading { sensor_id, channel, battery_low, data })
}
