//! Airborne Position (TC 9-18, 20-22). 56-bit ME body:
//!   TC (5) + SS (2) + SAF (1) + ALT (12) + T (1) + F (1=odd/0=even) + LAT-CPR (17) + LON-CPR (17)
//! CPR decoding is from RTCA DO-260B / ICAO Annex 10 Vol IV.

#[derive(Debug, Clone, Copy)]
pub struct CprFrame {
    pub odd: bool,
    pub lat_cpr: u32, // 17-bit
    pub lon_cpr: u32, // 17-bit
    pub altitude_ft: Option<i32>,
}

impl CprFrame {
    /// Parse a 7-byte ME body for a TC in the airborne-position range.
    pub fn parse(me: &[u8]) -> Self {
        debug_assert_eq!(me.len(), 7);
        // Bits indexed from MSB of me[0] = bit 0.
        let f_odd = (me[2] >> 2) & 0x01;
        // LAT-CPR: bits 22..39  (17 bits)
        let lat_cpr =
            (((me[2] as u32) & 0x03) << 15) | ((me[3] as u32) << 7) | ((me[4] as u32) >> 1);
        // LON-CPR: bits 39..56  (17 bits)
        let lon_cpr =
            (((me[4] as u32) & 0x01) << 16) | ((me[5] as u32) << 8) | (me[6] as u32);
        // Altitude (bits 8..20 in ME), 12-bit AC12-encoded.
        // bits 8-19 span me[1] (all 8 bits) and me[2] bits 7-4.
        let alt12 = ((me[1] as u32) << 4) | ((me[2] as u32) >> 4);
        let altitude_ft = decode_ac12_altitude(alt12 as u16);
        Self {
            odd: f_odd == 1,
            lat_cpr,
            lon_cpr,
            altitude_ft,
        }
    }
}

/// AC12 altitude decoding (Q-bit + 11 bits). Ignores Gillham (Q=0) — rare.
fn decode_ac12_altitude(ac12: u16) -> Option<i32> {
    if ac12 == 0 {
        return None;
    }
    let q = (ac12 >> 4) & 0x01;
    if q == 0 {
        return None; // Gillham; skip in v0.2
    }
    let n = ((ac12 & 0xFE0) >> 1) | (ac12 & 0x0F);
    Some(n as i32 * 25 - 1000)
}

const NB: f64 = 17.0;
const NZ: f64 = 15.0;

fn nl_func(lat: f64) -> u32 {
    if lat.abs() < 1e-9 {
        return 59;
    }
    if (lat.abs() - 87.0).abs() < 1e-9 {
        return 2;
    }
    if lat.abs() > 87.0 {
        return 1;
    }
    // ICAO Annex 10 / DO-260B: a = 1 - cos(pi / (2 * NZ))
    let a = 1.0 - (std::f64::consts::PI / (2.0 * NZ)).cos();
    let b = (lat.to_radians()).cos().powi(2);
    let nl = (2.0 * std::f64::consts::PI / (1.0 - a / b).acos()).floor() as u32;
    nl.max(1)
}

/// Locally-unambiguous decode given a reference position (within 180 NM).
/// Returns (lat, lon) in degrees.
pub fn decode_local(frame: &CprFrame, ref_lat: f64, ref_lon: f64) -> (f64, f64) {
    let dlat = if frame.odd { 360.0 / 59.0 } else { 360.0 / 60.0 };
    let lat_cpr = frame.lat_cpr as f64 / 2f64.powf(NB);
    let j = (ref_lat / dlat).floor() + (0.5 + (ref_lat.rem_euclid(dlat)) / dlat - lat_cpr).floor();
    let lat = dlat * (j + lat_cpr);
    let nl = nl_func(lat) as i32;
    let ni = if frame.odd { (nl - 1).max(1) } else { nl.max(1) };
    let dlon = 360.0 / ni as f64;
    let lon_cpr = frame.lon_cpr as f64 / 2f64.powf(NB);
    let m = (ref_lon / dlon).floor() + (0.5 + (ref_lon.rem_euclid(dlon)) / dlon - lon_cpr).floor();
    let lon = dlon * (m + lon_cpr);
    (lat, lon)
}

/// Globally-unambiguous decode requires both an even and odd frame within ~10 s.
/// `even_received_first` is true if the even frame was the most recent (per ICAO algorithm).
pub fn decode_global(even: &CprFrame, odd: &CprFrame, even_received_first: bool) -> Option<(f64, f64)> {
    debug_assert!(!even.odd);
    debug_assert!(odd.odd);

    let lat_cpr_e = even.lat_cpr as f64 / 2f64.powf(NB);
    let lat_cpr_o = odd.lat_cpr as f64 / 2f64.powf(NB);

    let j = (59.0 * lat_cpr_e - 60.0 * lat_cpr_o + 0.5).floor();
    let mut lat_e = (360.0 / 60.0) * (j.rem_euclid(60.0) + lat_cpr_e);
    let mut lat_o = (360.0 / 59.0) * (j.rem_euclid(59.0) + lat_cpr_o);
    if lat_e >= 270.0 { lat_e -= 360.0; }
    if lat_o >= 270.0 { lat_o -= 360.0; }

    if nl_func(lat_e) != nl_func(lat_o) {
        return None;
    }

    // even_received_first: even frame is more recent (t_even > t_odd).
    // Use lat_e and ni = nl(lat_e); otherwise use lat_o and ni = nl(lat_o) - 1.
    let (lat, nl) = if even_received_first {
        let nl = nl_func(lat_e) as i32;
        (lat_e, nl)
    } else {
        let nl = nl_func(lat_o) as i32;
        (lat_o, nl)
    };

    let ni = if even_received_first { nl.max(1) } else { (nl - 1).max(1) };

    let lon_cpr_e = even.lon_cpr as f64 / 2f64.powf(NB);
    let lon_cpr_o = odd.lon_cpr as f64 / 2f64.powf(NB);
    // m formula is identical regardless of which frame is more recent
    let m = (lon_cpr_e * (nl - 1) as f64 - lon_cpr_o * nl as f64 + 0.5).floor();

    let lon_cpr = if even_received_first { lon_cpr_e } else { lon_cpr_o };
    let mut lon = (360.0 / ni as f64) * (m.rem_euclid(ni as f64) + lon_cpr);
    if lon >= 180.0 { lon -= 360.0; }

    Some((lat, lon))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adsb::frame::AdsbFrame;
    use hex::decode as hex_decode;

    fn approx_eq(a: f64, b: f64, eps: f64) {
        assert!((a - b).abs() < eps, "expected ≈ {b}, got {a}");
    }

    #[test]
    fn parses_even_position_frame() {
        let bytes = hex_decode("8D40621D58C382D690C8AC2863A7").unwrap();
        let f = AdsbFrame::parse(&bytes).unwrap();
        let cpr = CprFrame::parse(f.me);
        assert!(!cpr.odd);
        assert_eq!(cpr.altitude_ft, Some(38_000));
    }

    #[test]
    fn parses_odd_position_frame() {
        let bytes = hex_decode("8D40621D58C386435CC412692AD6").unwrap();
        let f = AdsbFrame::parse(&bytes).unwrap();
        let cpr = CprFrame::parse(f.me);
        assert!(cpr.odd);
    }

    #[test]
    fn global_decode_klm() {
        // Public test vector: 8D40621D58C382D690C8AC2863A7 / 8D40621D58C386435CC412692AD6
        // Expected: ~52.2572° N, 3.9193° E
        let even = CprFrame::parse(
            &AdsbFrame::parse(&hex_decode("8D40621D58C382D690C8AC2863A7").unwrap())
                .unwrap()
                .me,
        );
        let odd = CprFrame::parse(
            &AdsbFrame::parse(&hex_decode("8D40621D58C386435CC412692AD6").unwrap())
                .unwrap()
                .me,
        );
        let (lat, lon) = decode_global(&even, &odd, true).expect("global decode");
        approx_eq(lat, 52.2572, 0.05);
        approx_eq(lon, 3.9193, 0.1);
    }

    #[test]
    fn local_decode_within_one_nm_of_reference() {
        // Use the even frame and a reference near the expected position.
        let even = CprFrame::parse(
            &AdsbFrame::parse(&hex_decode("8D40621D58C382D690C8AC2863A7").unwrap())
                .unwrap()
                .me,
        );
        let (lat, lon) = decode_local(&even, 52.0, 4.0);
        approx_eq(lat, 52.2572, 0.5);
        approx_eq(lon, 3.9193, 0.5);
    }
}
