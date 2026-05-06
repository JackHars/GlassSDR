//! Phase 4 protocol decoder tests: APT, DSC, EPIRB, DAB.

use mayhem_protocols::{
    apt::image::{AptDecoder, AptChannel},
    dab::fic::decode_fic,
    dsc::decode::{decode_dsc, DscCategory},
    epirb::decode::decode_epirb,
};

// ── APT ──────────────────────────────────────────────────────────────────────

#[test]
fn apt_decoder_produces_lines() {
    let sample_rate = 11_025.0_f32;
    let mut dec = AptDecoder::new(sample_rate);

    // Feed enough 0.5-amplitude samples to produce at least one scan line.
    // samples_per_line = round(11025 / 4160 * 2080) ≈ round(5512.5) = 5513
    let samples_per_line = (sample_rate / 4160.0 * 2080.0).round() as usize;
    let samples: Vec<f32> = vec![0.5_f32; samples_per_line * 3];

    let lines = dec.process(&samples);

    assert!(!lines.is_empty(), "expected at least one APT line");
    let first = &lines[0];
    assert_eq!(first.line_number, 0);
    assert_eq!(first.channel, AptChannel::A);
    assert_eq!(first.pixels.len(), 2080);
    // Every pixel should be round(0.5 * 255) = 127 or 128
    for &px in &first.pixels {
        assert!(px >= 126 && px <= 129, "unexpected pixel value {px}");
    }
}

#[test]
fn apt_decoder_alternates_channels() {
    let sample_rate = 11_025.0_f32;
    let mut dec = AptDecoder::new(sample_rate);
    let samples_per_line = (sample_rate / 4160.0 * 2080.0).round() as usize;
    let samples: Vec<f32> = vec![0.8_f32; samples_per_line * 4];
    let lines = dec.process(&samples);
    assert!(lines.len() >= 2, "need at least 2 lines to check channel alternation");
    assert_eq!(lines[0].channel, AptChannel::A);
    assert_eq!(lines[1].channel, AptChannel::B);
}

// ── DSC ──────────────────────────────────────────────────────────────────────

#[test]
fn dsc_decode_returns_message() {
    // Build a 20-symbol DSC message: format_code=112 (Distress), MMSI digits 1..=9
    let mut symbols = vec![0u8; 20];
    symbols[0] = 112; // format_code → Distress
    for i in 1..10 {
        symbols[i] = i as u8; // digits 1–9 → MMSI = 123456789
    }
    let msg = decode_dsc(&symbols).expect("expected a decoded DscMessage");
    assert_eq!(msg.format_code, 112);
    assert_eq!(msg.category, DscCategory::Distress);
    assert_eq!(msg.mmsi, 123_456_789);
}

#[test]
fn dsc_decode_too_short_returns_none() {
    let symbols = vec![0u8; 5];
    assert!(decode_dsc(&symbols).is_none());
}

#[test]
fn dsc_decode_safety_category() {
    let mut symbols = vec![0u8; 20];
    symbols[0] = 108; // Safety
    let msg = decode_dsc(&symbols).unwrap();
    assert_eq!(msg.category, DscCategory::Safety);
}

#[test]
fn dsc_decode_routine_fallback() {
    let mut symbols = vec![0u8; 20];
    symbols[0] = 42; // unknown → Routine
    let msg = decode_dsc(&symbols).unwrap();
    assert_eq!(msg.category, DscCategory::Routine);
}

// ── EPIRB ─────────────────────────────────────────────────────────────────────

#[test]
fn epirb_decode_returns_beacon() {
    // Construct a minimal 112-bit beacon.
    let mut bits = vec![false; 112];
    // country_code at bits[27..37]: set to binary 0b0001000010 = 66
    bits[27] = false;
    bits[28] = false;
    bits[29] = false;
    bits[30] = true;
    bits[31] = false;
    bits[32] = false;
    bits[33] = false;
    bits[34] = false;
    bits[35] = true;
    bits[36] = false;
    // protocol at bits[37..40]: 0b011 = 3
    bits[37] = false;
    bits[38] = true;
    bits[39] = true;

    let beacon = decode_epirb(&bits).expect("expected a decoded EpirbBeacon");
    assert_eq!(beacon.country_code, 66);
    assert_eq!(beacon.protocol, 3);
    assert!(!beacon.hex_id.is_empty(), "hex_id should not be empty");
}

#[test]
fn epirb_decode_too_short_returns_none() {
    let bits = vec![false; 50];
    assert!(decode_epirb(&bits).is_none());
}

// ── DAB FIC ──────────────────────────────────────────────────────────────────

#[test]
fn dab_decode_returns_ensemble() {
    // Construct a minimal FIB: FIG type=0 (bits 7-5 = 000), len=4 (bits 4-0 = 00100 = 4)
    // EID in bytes [1..=2]
    let mut fib = vec![0u8; 32];
    // header byte: type=0 (000), len=4 (00100) → 0b000_00100 = 0x04
    fib[0] = 0x04;
    // EID: 0xABCD
    fib[1] = 0xAB;
    fib[2] = 0xCD;
    // terminator FIG at offset 5: type=7 → 0b111_00000 = 0xE0
    fib[5] = 0xE0;

    let blocks: Vec<&[u8]> = vec![&fib];
    let ensemble = decode_fic(&blocks);

    assert_eq!(ensemble.eid, 0xABCD);
}

#[test]
fn dab_decode_empty_blocks_returns_default() {
    let ensemble = decode_fic(&[]);
    assert_eq!(ensemble.eid, 0);
    assert!(ensemble.label.is_empty());
    assert!(ensemble.services.is_empty());
}
