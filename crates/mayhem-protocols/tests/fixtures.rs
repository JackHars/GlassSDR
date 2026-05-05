//! Canonical ADS-B test frames sourced from public test vectors (pyModeS, ICAO Doc 9871).
//! Each constant is the 14-byte (28-hex-char) DF17 message exactly as transmitted.

#![allow(dead_code)]

/// Aircraft Identification — callsign "KLM1023" — ICAO24 4840D6
/// TC = 4 (in TC 1-4 range, "Aircraft Identification")
pub const AID_KLM1023: &str = "8D4840D6202CC371C32CE0576098";

/// Airborne Position — even frame — ICAO24 40621D — altitude 38000 ft
pub const POS_EVEN_40621D: &str = "8D40621D58C382D690C8AC2863A7";

/// Airborne Position — odd frame — ICAO24 40621D — altitude 38000 ft
pub const POS_ODD_40621D: &str = "8D40621D58C386435CC412692AD6";

/// Airborne Velocity — ICAO24 485020 — ground speed ~159 kt, heading ~183°
pub const VEL_485020: &str = "8D485020994409940838175B284F";

/// Hex → 14-byte vector. Panics on invalid hex (acceptable in tests).
pub fn parse_hex(s: &str) -> Vec<u8> {
    hex::decode(s).expect("invalid hex fixture")
}
