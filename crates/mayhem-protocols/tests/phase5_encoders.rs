//! Phase 5 encoder tests: Baudot, Morse, SSTV.

use mayhem_protocols::baudot::{encode_baudot, baudot_to_nrz};
use mayhem_protocols::morse::{encode_morse, MorseElement};
use mayhem_protocols::sstv::encode_sstv_robot36;

// ── Baudot ────────────────────────────────────────────────────────────────────

#[test]
fn baudot_encode_letters() {
    let chars = encode_baudot("SOS");
    // S=0x05, O=0x18, S=0x05 — no FIGS shift needed, so exactly 3 chars
    assert_eq!(chars.len(), 3);
}

#[test]
fn baudot_encode_digits_inserts_figs() {
    let chars = encode_baudot("123");
    // FIGS shift + 3 digits = 4 chars
    assert_eq!(chars.len(), 4);
    // First char must be FIGS (0x1B = 0b11011)
    let figs_bits = [true, true, false, true, true]; // 0x1B lsb-first
    assert_eq!(chars[0].bits, figs_bits);
}

#[test]
fn baudot_encode_mixed_shifts() {
    // "A1B" → A (LTRS), FIGS shift, 1, LTRS shift, B → 5 chars
    let chars = encode_baudot("A1B");
    assert_eq!(chars.len(), 5);
}

#[test]
fn baudot_nrz_structure() {
    let chars = encode_baudot("E"); // single letter
    let bits = baudot_to_nrz(&chars);
    // 1 char → start(1) + 5 data + stop(1) + half-stop(1) = 8 bits
    assert_eq!(bits.len(), 8);
    assert!(!bits[0]); // start bit = false (space)
    assert!(bits[6]);  // stop bit = true (mark)
    assert!(bits[7]);  // extra half-stop = true
}

#[test]
fn baudot_space_no_shift() {
    // Space is valid in both shifts; should not insert a FIGS shift
    let chars = encode_baudot("A 1");
    // A, space, FIGS, 1 = 4 chars
    assert_eq!(chars.len(), 4);
}

// ── Morse ─────────────────────────────────────────────────────────────────────

#[test]
fn morse_single_letter_e() {
    let elems = encode_morse("E");
    assert_eq!(elems, vec![MorseElement::Dit]);
}

#[test]
fn morse_sos() {
    let elems = encode_morse("SOS");
    // S = D I D, O = D A D, S = D I D
    // With char gaps between: S, CharGap, O, CharGap, S
    // S: Dit IntraGap Dit IntraGap Dit
    // O: Dah IntraGap Dah IntraGap Dah
    let dits: Vec<_> = elems.iter().filter(|&&e| e == MorseElement::Dit).collect();
    let dahs: Vec<_> = elems.iter().filter(|&&e| e == MorseElement::Dah).collect();
    assert_eq!(dits.len(), 6); // 3 from each S
    assert_eq!(dahs.len(), 3); // 3 from O
}

#[test]
fn morse_word_gap_between_words() {
    let elems = encode_morse("E E");
    assert!(elems.contains(&MorseElement::WordGap));
    let word_gaps: Vec<_> = elems.iter().filter(|&&e| e == MorseElement::WordGap).collect();
    assert_eq!(word_gaps.len(), 1);
}

#[test]
fn morse_digits() {
    let elems = encode_morse("5");
    // 5 = D D D D D
    let dits: Vec<_> = elems.iter().filter(|&&e| e == MorseElement::Dit).collect();
    assert_eq!(dits.len(), 5);
}

#[test]
fn morse_unknown_char_skipped() {
    let elems = encode_morse("E@E");
    // '@' has no Morse code, so only 2 chars separated by CharGap
    // But with '@' in the middle of a word, it produces E CharGap E
    // (@ is skipped, no CharGap added for it)
    assert!(!elems.is_empty());
    let dits: Vec<_> = elems.iter().filter(|&&e| e == MorseElement::Dit).collect();
    assert_eq!(dits.len(), 2); // two E's
}

// ── SSTV ──────────────────────────────────────────────────────────────────────

#[test]
fn sstv_robot36_output_is_non_empty() {
    let pixels = vec![128u8; 320 * 240];
    let freqs = encode_sstv_robot36(&pixels, 320, 240, 48_000.0);
    assert!(!freqs.is_empty());
}

#[test]
fn sstv_robot36_freq_in_range() {
    let pixels = vec![0u8; 320 * 240]; // all black
    let freqs = encode_sstv_robot36(&pixels, 320, 240, 48_000.0);
    for &f in &freqs {
        assert!(f >= 1100.0 && f <= 2300.0, "frequency {} out of SSTV range", f);
    }
}

#[test]
fn sstv_robot36_leader_tone() {
    let pixels = vec![128u8; 10 * 10];
    let freqs = encode_sstv_robot36(&pixels, 10, 10, 48_000.0);
    // First ~14400 samples should be the 300ms leader at 1900 Hz
    let leader_len = (0.3 * 48_000.0) as usize;
    assert!(freqs.len() >= leader_len);
    for i in 0..leader_len {
        assert!((freqs[i] - 1900.0).abs() < 1.0, "leader sample {} freq {}", i, freqs[i]);
    }
}

#[test]
fn sstv_robot36_black_pixel_freq() {
    // A single black pixel (0) should encode to FREQ_BLACK = 1500 Hz
    let pixels = vec![0u8; 320 * 240];
    let freqs = encode_sstv_robot36(&pixels, 320, 240, 48_000.0);
    // Image data starts after leader + VIS code (~14400 + ~10 samples)
    // The first image sample is a sync pulse at 1200 Hz, then pixel data
    let has_black = freqs.iter().any(|&f| (f - 1500.0).abs() < 1.0);
    assert!(has_black, "no black-pixel frequency (1500 Hz) found in output");
}

#[test]
fn sstv_robot36_white_pixel_freq() {
    let pixels = vec![255u8; 320 * 240];
    let freqs = encode_sstv_robot36(&pixels, 320, 240, 48_000.0);
    let has_white = freqs.iter().any(|&f| (f - 2300.0).abs() < 1.0);
    assert!(has_white, "no white-pixel frequency (2300 Hz) found in output");
}
