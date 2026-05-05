//! Airborne Velocity (TC 19). For v0.2 we only handle subtype 1 (groundspeed) — the most common case.

#[derive(Debug, Clone, Copy)]
pub struct Velocity {
    pub ground_speed_kt: f64,
    pub heading_deg: f64,
    pub vert_rate_fpm: i32,
}

pub fn decode(me: &[u8]) -> Option<Velocity> {
    debug_assert_eq!(me.len(), 7);
    let subtype = me[0] & 0x07;
    if subtype != 1 && subtype != 2 {
        return None; // v0.2: only ground velocity (subtypes 1 and 2)
    }
    let s_ew = (me[1] >> 2) & 0x01; // 1 = west, 0 = east
    let v_ew_raw = (((me[1] as u32) & 0x03) << 8) | (me[2] as u32);
    let s_ns = (me[3] >> 7) & 0x01; // 1 = south, 0 = north
    let v_ns_raw = (((me[3] as u32) & 0x7F) << 3) | ((me[4] as u32) >> 5);
    if v_ew_raw == 0 || v_ns_raw == 0 {
        return None;
    }
    let mut v_ew = (v_ew_raw - 1) as f64;
    let mut v_ns = (v_ns_raw - 1) as f64;
    if subtype == 2 {
        v_ew *= 4.0;
        v_ns *= 4.0;
    }
    if s_ew == 1 { v_ew = -v_ew; }
    if s_ns == 1 { v_ns = -v_ns; }
    let ground_speed_kt = (v_ew * v_ew + v_ns * v_ns).sqrt();
    let mut heading_deg = (v_ew.atan2(v_ns)).to_degrees();
    if heading_deg < 0.0 { heading_deg += 360.0; }

    // Vertical rate (bits 36..46 of ME, 9 bits + sign)
    // me[4] bits 4: vr_src, bit 3: s_vr, bits 2-0: vr upper 3 bits
    // me[5] bits 7-2: vr lower 6 bits
    let vr_sign = (me[4] >> 3) & 0x01;
    let vr_raw = (((me[4] as u32) & 0x07) << 6) | ((me[5] as u32) >> 2);
    let mut vert_rate_fpm = if vr_raw > 0 { (vr_raw - 1) as i32 * 64 } else { 0 };
    if vr_sign == 1 { vert_rate_fpm = -vert_rate_fpm; }

    Some(Velocity { ground_speed_kt, heading_deg, vert_rate_fpm })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adsb::frame::AdsbFrame;
    use hex::decode as hex_decode;

    #[test]
    fn decodes_known_velocity_frame() {
        let bytes = hex_decode("8D485020994409940838175B284F").unwrap();
        let f = AdsbFrame::parse(&bytes).unwrap();
        let v = decode(f.me).expect("velocity");
        // Public test vector: ~159 kt, ~183°
        assert!((v.ground_speed_kt - 159.0).abs() < 5.0, "got speed {}", v.ground_speed_kt);
        assert!((v.heading_deg - 183.0).abs() < 5.0, "got heading {}", v.heading_deg);
    }
}
