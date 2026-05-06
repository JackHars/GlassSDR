# Mayhem PC Phase 5 — Amateur TX Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 amateur TX apps: RTTY TX, SSTV TX, AFSK TX (APRS), Morse TX, Soundboard TX, and FLEX TX. All reuse Phase 0's HackRF sink + arm/disarm infrastructure. Each encodes a different format and feeds IQ to the sink.

**Architecture:** New protocol encoders in `mayhem-protocols` (Baudot, SSTV, Morse). New DSP modulators where needed (AFSK modulator, CW keyer). All apps are RegulatoryClass::AmateurOnly and use the existing legal banner + arm/disarm flow.

**Spec reference:** `docs/superpowers/phase-specs/phase-5-amateur-tx.md`

---

## File structure produced by this plan

```
crates/mayhem-dsp/src/
├── afsk_mod.rs                    # AFSK modulator (Bell 202 + configurable)
├── cw_keyer.rs                    # CW (on/off keying) with raised-cosine edges
├── fm_mod.rs                      # FM modulator (audio → IQ, for soundboard)
└── lib.rs

crates/mayhem-protocols/src/
├── baudot/
│   ├── mod.rs
│   └── encode.rs                  # Baudot/ITA2 encoder (text → 5-bit codes)
├── sstv/
│   ├── mod.rs
│   ├── modes.rs                   # SSTV mode definitions (Robot, Martin, Scottie)
│   └── encode.rs                  # Image → frequency-time tone sequence
├── morse/
│   ├── mod.rs
│   └── encode.rs                  # Text → dit/dah timing sequence
├── ax25/
│   └── encode.rs                  # AX.25 frame builder (for AFSK TX/APRS)
└── lib.rs

crates/mayhem-apps/src/
├── rtty_tx.rs
├── sstv_tx.rs
├── afsk_tx.rs
├── morse_tx.rs
├── soundboard_tx.rs
├── flex_tx.rs
└── lib.rs

crates/mayhem-ipc/src/lib.rs

frontend/src/apps/
├── rtty-tx/RttyTxApp.tsx
├── sstv-tx/SstvTxApp.tsx
├── afsk-tx/AfskTxApp.tsx
├── morse-tx/MorseTxApp.tsx
├── soundboard-tx/SoundboardTxApp.tsx
└── flex-tx/FlexTxApp.tsx
```

---

## Task 1: Baudot/ITA2 encoder (mayhem-protocols)

**Why first:** RTTY TX needs text → 5-bit Baudot conversion with LTRS/FIGS shift handling.

**Files:**
- Create: `crates/mayhem-protocols/src/baudot/mod.rs`
- Create: `crates/mayhem-protocols/src/baudot/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement Baudot encoder**

```rust
//! Baudot / ITA2 encoder for RTTY.
//! Converts ASCII text to 5-bit Baudot codes with LTRS/FIGS shift management.

pub mod encode;
pub use encode::encode_baudot;

/// Baudot shift state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shift {
    Letters,
    Figures,
}

/// A single Baudot character with framing.
#[derive(Debug, Clone, Copy)]
pub struct BaudotChar {
    pub start_bit: bool,  // always false (space)
    pub data: [bool; 5],  // 5 data bits, LSB first
    pub stop_bits: f32,   // 1.0 or 1.5 stop bits (mark)
}
```

```rust
// encode.rs
use super::{BaudotChar, Shift};

// ITA2 lookup tables
const LTRS: [char; 32] = [
    '\0', 'E', '\n', 'A', ' ', 'S', 'I', 'U',
    '\r', 'D', 'R', 'J', 'N', 'F', 'C', 'K',
    'T', 'Z', 'L', 'W', 'H', 'Y', 'P', 'Q',
    'O', 'B', 'G', '\x0E', 'M', 'X', 'V', '\x0F',
];

const FIGS: [char; 32] = [
    '\0', '3', '\n', '-', ' ', '\x07', '8', '7',
    '\r', '$', '4', '\'', ',', '!', ':', '(',
    '5', '"', ')', '2', '#', '6', '0', '1',
    '9', '?', '&', '\x0E', '.', '/', ';', '\x0F',
];

const SHIFT_LTRS: u8 = 31; // 11111
const SHIFT_FIGS: u8 = 27; // 11011

/// Encode ASCII text to Baudot characters.
/// Handles automatic LTRS/FIGS shifting.
/// stop_bits: 1.0 for standard, 1.5 for legacy.
pub fn encode_baudot(text: &str, stop_bits: f32) -> Vec<BaudotChar> {
    let mut result = Vec::new();
    let mut current_shift = Shift::Letters;

    // Start with LTRS shift
    result.push(make_char(SHIFT_LTRS, stop_bits));

    for ch in text.chars().map(|c| c.to_uppercase().next().unwrap_or(c)) {
        if let Some((code, needed_shift)) = lookup_char(ch) {
            if needed_shift != current_shift {
                // Insert shift character
                let shift_code = match needed_shift {
                    Shift::Letters => SHIFT_LTRS,
                    Shift::Figures => SHIFT_FIGS,
                };
                result.push(make_char(shift_code, stop_bits));
                current_shift = needed_shift;
            }
            result.push(make_char(code, stop_bits));
        }
        // Skip characters not in Baudot set
    }

    result
}

fn lookup_char(ch: char) -> Option<(u8, Shift)> {
    // Search LTRS table first
    for (i, &c) in LTRS.iter().enumerate() {
        if c == ch {
            return Some((i as u8, Shift::Letters));
        }
    }
    // Then FIGS
    for (i, &c) in FIGS.iter().enumerate() {
        if c == ch {
            return Some((i as u8, Shift::Figures));
        }
    }
    // Space is same in both
    if ch == ' ' {
        return Some((4, Shift::Letters));
    }
    None
}

fn make_char(code: u8, stop_bits: f32) -> BaudotChar {
    let mut data = [false; 5];
    for i in 0..5 {
        data[i] = (code >> i) & 1 == 1;
    }
    BaudotChar {
        start_bit: false, // space
        data,
        stop_bits,
    }
}

/// Convert BaudotChar sequence to NRZ bit stream (for FSK modulation).
/// Mark = true, Space = false.
/// Returns bits with timing (each bool represents one bit period).
pub fn baudot_to_bits(chars: &[BaudotChar], samples_per_bit: usize) -> Vec<bool> {
    let mut bits = Vec::new();
    for ch in chars {
        // Start bit (space = false)
        for _ in 0..samples_per_bit {
            bits.push(false);
        }
        // 5 data bits (LSB first)
        for &bit in &ch.data {
            for _ in 0..samples_per_bit {
                bits.push(bit);
            }
        }
        // Stop bit(s) (mark = true)
        let stop_samples = (ch.stop_bits * samples_per_bit as f32).round() as usize;
        for _ in 0..stop_samples {
            bits.push(true);
        }
    }
    bits
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_hello() {
        let chars = encode_baudot("HELLO", 1.5);
        // LTRS shift + H + E + L + L + O = 6 chars
        assert_eq!(chars.len(), 6);
    }

    #[test]
    fn encode_with_figures() {
        let chars = encode_baudot("HI 123", 1.0);
        // LTRS + H + I + space + FIGS + 1 + 2 + 3 = 8 chars
        assert!(chars.len() >= 7);
    }

    #[test]
    fn bits_length() {
        let chars = encode_baudot("A", 1.0);
        let bits = baudot_to_bits(&chars, 1);
        // Each char: 1 start + 5 data + 1 stop = 7 bits. Two chars (LTRS + A) = 14 bits.
        assert_eq!(bits.len(), 14);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/baudot/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: Baudot/ITA2 encoder for RTTY (shift management + NRZ bits)"
```

---

## Task 2: Morse code encoder

**Files:**
- Create: `crates/mayhem-protocols/src/morse/mod.rs`
- Create: `crates/mayhem-protocols/src/morse/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement Morse encoder**

```rust
//! ITU Morse code encoder. Text → timing sequence (key-down/key-up durations).

pub mod encode;
pub use encode::{encode_morse, MorseElement, MorseParams};

#[derive(Debug, Clone, Copy)]
pub enum MorseElement {
    Dit,          // 1 unit key-down
    Dah,          // 3 units key-down
    IntraChar,    // 1 unit key-up (between elements)
    InterChar,    // 3 units key-up (between characters)
    InterWord,    // 7 units key-up (between words)
}
```

```rust
// encode.rs
use super::MorseElement;

#[derive(Debug, Clone)]
pub struct MorseParams {
    pub wpm: f32,          // Words per minute (standard = PARIS timing)
    pub farnsworth_wpm: Option<f32>, // Extended spacing between chars (for learning)
}

impl MorseParams {
    /// Duration of one dit in seconds.
    pub fn dit_duration_s(&self) -> f32 {
        1.2 / self.wpm
    }

    /// Duration of inter-character gap (possibly stretched for Farnsworth).
    pub fn interchar_duration_s(&self) -> f32 {
        if let Some(fw) = self.farnsworth_wpm {
            3.0 * 1.2 / fw
        } else {
            3.0 * self.dit_duration_s()
        }
    }

    /// Duration of inter-word gap.
    pub fn interword_duration_s(&self) -> f32 {
        if let Some(fw) = self.farnsworth_wpm {
            7.0 * 1.2 / fw
        } else {
            7.0 * self.dit_duration_s()
        }
    }
}

/// Encode text to Morse elements.
pub fn encode_morse(text: &str) -> Vec<MorseElement> {
    let mut elements = Vec::new();
    let mut first_char = true;

    for word in text.split_whitespace() {
        if !first_char {
            elements.push(MorseElement::InterWord);
        }
        let mut first_in_word = true;
        for ch in word.chars() {
            if !first_in_word {
                elements.push(MorseElement::InterChar);
            }
            if let Some(pattern) = char_to_morse(ch) {
                for (i, &element) in pattern.iter().enumerate() {
                    if i > 0 {
                        elements.push(MorseElement::IntraChar);
                    }
                    elements.push(element);
                }
            }
            first_in_word = false;
        }
        first_char = false;
    }

    elements
}

/// Convert Morse elements to key-down samples (for CW generation).
/// Returns Vec of (key_down: bool, duration_samples: usize).
pub fn morse_to_keying(elements: &[MorseElement], params: &MorseParams, sample_rate: f32) -> Vec<(bool, usize)> {
    let dit_samples = (params.dit_duration_s() * sample_rate).round() as usize;
    let mut keying = Vec::new();

    for &elem in elements {
        match elem {
            MorseElement::Dit => keying.push((true, dit_samples)),
            MorseElement::Dah => keying.push((true, dit_samples * 3)),
            MorseElement::IntraChar => keying.push((false, dit_samples)),
            MorseElement::InterChar => {
                let dur = (params.interchar_duration_s() * sample_rate).round() as usize;
                keying.push((false, dur));
            }
            MorseElement::InterWord => {
                let dur = (params.interword_duration_s() * sample_rate).round() as usize;
                keying.push((false, dur));
            }
        }
    }

    keying
}

fn char_to_morse(ch: char) -> Option<&'static [MorseElement]> {
    use MorseElement::{Dit as D, Dah as T};
    match ch.to_uppercase().next().unwrap_or(ch) {
        'A' => Some(&[D, T]),
        'B' => Some(&[T, D, D, D]),
        'C' => Some(&[T, D, T, D]),
        'D' => Some(&[T, D, D]),
        'E' => Some(&[D]),
        'F' => Some(&[D, D, T, D]),
        'G' => Some(&[T, T, D]),
        'H' => Some(&[D, D, D, D]),
        'I' => Some(&[D, D]),
        'J' => Some(&[D, T, T, T]),
        'K' => Some(&[T, D, T]),
        'L' => Some(&[D, T, D, D]),
        'M' => Some(&[T, T]),
        'N' => Some(&[T, D]),
        'O' => Some(&[T, T, T]),
        'P' => Some(&[D, T, T, D]),
        'Q' => Some(&[T, T, D, T]),
        'R' => Some(&[D, T, D]),
        'S' => Some(&[D, D, D]),
        'T' => Some(&[T]),
        'U' => Some(&[D, D, T]),
        'V' => Some(&[D, D, D, T]),
        'W' => Some(&[D, T, T]),
        'X' => Some(&[T, D, D, T]),
        'Y' => Some(&[T, D, T, T]),
        'Z' => Some(&[T, T, D, D]),
        '0' => Some(&[T, T, T, T, T]),
        '1' => Some(&[D, T, T, T, T]),
        '2' => Some(&[D, D, T, T, T]),
        '3' => Some(&[D, D, D, T, T]),
        '4' => Some(&[D, D, D, D, T]),
        '5' => Some(&[D, D, D, D, D]),
        '6' => Some(&[T, D, D, D, D]),
        '7' => Some(&[T, T, D, D, D]),
        '8' => Some(&[T, T, T, D, D]),
        '9' => Some(&[T, T, T, T, D]),
        '.' => Some(&[D, T, D, T, D, T]),
        ',' => Some(&[T, T, D, D, T, T]),
        '?' => Some(&[D, D, T, T, D, D]),
        '/' => Some(&[T, D, D, T, D]),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_sos() {
        let elements = encode_morse("SOS");
        // S=... O=--- S=... with inter-char gaps
        // DDD + interchar + TTT + interchar + DDD
        assert!(elements.len() > 10);
    }

    #[test]
    fn wpm_timing() {
        let params = MorseParams { wpm: 20.0, farnsworth_wpm: None };
        assert!((params.dit_duration_s() - 0.06).abs() < 0.001); // 1.2/20 = 0.06s
    }

    #[test]
    fn keying_output() {
        let elements = encode_morse("E"); // single dit
        let params = MorseParams { wpm: 20.0, farnsworth_wpm: None };
        let keying = morse_to_keying(&elements, &params, 48000.0);
        assert_eq!(keying.len(), 1);
        assert_eq!(keying[0].0, true); // key down
        assert_eq!(keying[0].1, 2880); // 0.06s * 48000 = 2880
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/morse/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: ITU Morse encoder (text → timing, Farnsworth support)"
```

---

## Task 3: SSTV mode definitions + image encoder

**Files:**
- Create: `crates/mayhem-protocols/src/sstv/mod.rs`
- Create: `crates/mayhem-protocols/src/sstv/modes.rs`
- Create: `crates/mayhem-protocols/src/sstv/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement SSTV encoder (Robot 36 mode)**

```rust
// modes.rs
//! SSTV mode definitions.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SstvMode {
    Robot36,
    Robot72,
    MartinM1,
    MartinM2,
    ScottieS1,
    ScottieS2,
}

#[derive(Debug, Clone)]
pub struct ModeParams {
    pub name: &'static str,
    pub width: u32,
    pub height: u32,
    pub line_time_ms: f64,
    pub vis_code: u8, // VIS (Vertical Interval Signaling) code
    pub color_format: ColorFormat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorFormat {
    Yuv,  // Robot modes
    Grb,  // Martin/Scottie modes (Green-Red-Blue line sequence)
}

impl SstvMode {
    pub fn params(self) -> ModeParams {
        match self {
            Self::Robot36 => ModeParams {
                name: "Robot 36", width: 320, height: 240,
                line_time_ms: 150.0, vis_code: 8, color_format: ColorFormat::Yuv,
            },
            Self::Robot72 => ModeParams {
                name: "Robot 72", width: 320, height: 240,
                line_time_ms: 300.0, vis_code: 12, color_format: ColorFormat::Yuv,
            },
            Self::MartinM1 => ModeParams {
                name: "Martin M1", width: 320, height: 256,
                line_time_ms: 446.446, vis_code: 44, color_format: ColorFormat::Grb,
            },
            Self::MartinM2 => ModeParams {
                name: "Martin M2", width: 320, height: 256,
                line_time_ms: 226.7986, vis_code: 40, color_format: ColorFormat::Grb,
            },
            Self::ScottieS1 => ModeParams {
                name: "Scottie S1", width: 320, height: 256,
                line_time_ms: 428.22, vis_code: 60, color_format: ColorFormat::Grb,
            },
            Self::ScottieS2 => ModeParams {
                name: "Scottie S2", width: 320, height: 256,
                line_time_ms: 277.692, vis_code: 56, color_format: ColorFormat::Grb,
            },
        }
    }
}
```

```rust
// encode.rs
//! SSTV image → audio tone sequence encoder.
//!
//! Produces a Vec<f32> of instantaneous frequencies (Hz) that represent the SSTV signal.
//! The caller converts these to IQ samples via FM modulation.

use super::modes::{ColorFormat, SstvMode};

/// SSTV frequency mapping.
const FREQ_BLACK: f32 = 1500.0;
const FREQ_WHITE: f32 = 2300.0;
const FREQ_SYNC: f32 = 1200.0;
const FREQ_VIS_BIT1: f32 = 1100.0;
const FREQ_VIS_BIT0: f32 = 1300.0;

/// Encode an image as SSTV audio frequencies.
///
/// - `image`: RGB pixel data, row-major, 3 bytes per pixel.
/// - `width`, `height`: image dimensions (will be resized if != mode dimensions).
/// - `mode`: SSTV mode.
/// - `sample_rate`: output sample rate for frequency sequence.
///
/// Returns: Vec of instantaneous frequency values at the given sample rate.
pub fn encode_sstv(image: &[u8], width: u32, height: u32, mode: SstvMode, sample_rate: f32) -> Vec<f32> {
    let params = mode.params();
    let mut freqs = Vec::new();

    // 1. Leader tone (300ms of 1900 Hz)
    append_tone(&mut freqs, 1900.0, 0.3, sample_rate);

    // 2. VIS code
    encode_vis(&mut freqs, params.vis_code, sample_rate);

    // 3. Image lines
    let samples_per_line = (params.line_time_ms / 1000.0 * sample_rate as f64) as usize;

    for row in 0..params.height.min(height) {
        // Sync pulse (5ms)
        append_tone(&mut freqs, FREQ_SYNC, 0.005, sample_rate);

        // Pixel data
        let pixels_per_line_sample = params.width as f32 / (samples_per_line as f32 - sample_rate * 0.005);

        for s in 0..(samples_per_line - (sample_rate * 0.005) as usize) {
            let col = (s as f32 * pixels_per_line_sample) as u32;
            let col = col.min(params.width - 1).min(width - 1);

            let pixel_idx = (row * width + col) as usize * 3;
            if pixel_idx + 2 >= image.len() { break; }

            let r = image[pixel_idx] as f32;
            let g = image[pixel_idx + 1] as f32;
            let b = image[pixel_idx + 2] as f32;

            // For Robot modes: Y luminance
            let luminance = match params.color_format {
                ColorFormat::Yuv => 0.299 * r + 0.587 * g + 0.114 * b,
                ColorFormat::Grb => {
                    // Scan order depends on line sub-position — simplified to luminance
                    0.299 * r + 0.587 * g + 0.114 * b
                }
            };

            let freq = FREQ_BLACK + (luminance / 255.0) * (FREQ_WHITE - FREQ_BLACK);
            freqs.push(freq);
        }
    }

    // 4. Tail tone
    append_tone(&mut freqs, FREQ_BLACK, 0.1, sample_rate);

    freqs
}

fn encode_vis(freqs: &mut Vec<f32>, vis_code: u8, sample_rate: f32) {
    // VIS: 1200 Hz leader (300ms) + start bit (30ms 1200Hz) + 8 data bits (30ms each) + stop bit (30ms 1200Hz)
    append_tone(freqs, FREQ_SYNC, 0.01, sample_rate); // break
    append_tone(freqs, FREQ_SYNC, 0.3, sample_rate);  // leader

    // Start bit
    append_tone(freqs, FREQ_SYNC, 0.03, sample_rate);

    // 8 bits LSB first
    for i in 0..8 {
        let bit = (vis_code >> i) & 1;
        let freq = if bit == 1 { FREQ_VIS_BIT1 } else { FREQ_VIS_BIT0 };
        append_tone(freqs, freq, 0.03, sample_rate);
    }

    // Stop bit
    append_tone(freqs, FREQ_SYNC, 0.03, sample_rate);
}

fn append_tone(freqs: &mut Vec<f32>, freq: f32, duration_s: f32, sample_rate: f32) {
    let n = (duration_s * sample_rate).round() as usize;
    freqs.extend(std::iter::repeat(freq).take(n));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_produces_output() {
        let image = vec![128u8; 320 * 240 * 3]; // gray image
        let freqs = encode_sstv(&image, 320, 240, SstvMode::Robot36, 11025.0);
        assert!(freqs.len() > 10000); // Should produce substantial output
    }

    #[test]
    fn frequencies_in_range() {
        let image = vec![0u8; 320 * 240 * 3]; // black image
        let freqs = encode_sstv(&image, 320, 240, SstvMode::Robot36, 11025.0);
        for &f in &freqs {
            assert!(f >= 1100.0 && f <= 2400.0, "freq {f} out of SSTV range");
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/sstv/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: SSTV encoder (Robot 36 + mode definitions)"
```

---

## Task 4: AX.25 frame encoder (for AFSK TX / APRS)

**Files:**
- Create: `crates/mayhem-protocols/src/ax25/encode.rs`
- Modify: `crates/mayhem-protocols/src/ax25/mod.rs`

- [ ] **Step 1: Implement AX.25 frame builder**

```rust
//! AX.25 frame encoder: build frames with proper addressing, bit-stuffing, and CRC.

use super::frame::{crc16_ccitt, Callsign};

/// Build a complete AX.25 UI frame (unnumbered information — used by APRS).
/// Returns bytes including flags and FCS, ready for NRZI encoding.
pub fn build_ui_frame(src: &Callsign, dst: &Callsign, digis: &[Callsign], payload: &[u8]) -> Vec<u8> {
    let mut frame_bytes = Vec::new();

    // Destination address (7 bytes)
    encode_address(&mut frame_bytes, dst, false, digis.is_empty());
    // Source address (7 bytes)
    encode_address(&mut frame_bytes, src, false, digis.is_empty() /* last if no digis */);
    // Digipeater addresses
    for (i, digi) in digis.iter().enumerate() {
        encode_address(&mut frame_bytes, digi, false, i == digis.len() - 1);
    }
    // Mark last address byte
    if let Some(last) = frame_bytes.last_mut() {
        *last |= 0x01; // Set end-of-address bit
    }

    // Control field: UI frame = 0x03
    frame_bytes.push(0x03);
    // PID: No layer 3 = 0xF0
    frame_bytes.push(0xF0);
    // Payload
    frame_bytes.extend_from_slice(payload);

    // FCS (CRC-16/CCITT)
    let fcs = crc16_ccitt(&frame_bytes);
    frame_bytes.push(fcs as u8);
    frame_bytes.push((fcs >> 8) as u8);

    frame_bytes
}

/// Convert frame bytes to HDLC bit stream (with bit-stuffing and flags).
pub fn hdlc_encode(frame: &[u8]) -> Vec<u8> {
    let mut bits = Vec::new();

    // Opening flag
    push_flag(&mut bits);

    // Frame content with bit-stuffing
    let mut ones_count = 0;
    for &byte in frame {
        for i in 0..8 {
            let bit = (byte >> i) & 1; // LSB first
            bits.push(bit);
            if bit == 1 {
                ones_count += 1;
                if ones_count == 5 {
                    bits.push(0); // stuff a zero
                    ones_count = 0;
                }
            } else {
                ones_count = 0;
            }
        }
    }

    // Closing flag
    push_flag(&mut bits);

    bits
}

/// NRZI encode: 0 = transition, 1 = no transition.
pub fn nrzi_encode(bits: &[u8]) -> Vec<u8> {
    let mut result = Vec::with_capacity(bits.len());
    let mut last = 0u8;
    for &bit in bits {
        if bit == 1 {
            // No transition
            result.push(last);
        } else {
            // Transition
            last ^= 1;
            result.push(last);
        }
    }
    result
}

fn encode_address(bytes: &mut Vec<u8>, call: &Callsign, has_been_repeated: bool, _is_last: bool) {
    // Callsign: 6 chars, space-padded, shifted left 1 bit
    let call_bytes = call.call.as_bytes();
    for i in 0..6 {
        let ch = if i < call_bytes.len() { call_bytes[i] } else { b' ' };
        bytes.push(ch << 1);
    }
    // SSID byte: C/R bits + SSID + extension bit
    let ssid_byte = 0x60 | ((call.ssid & 0x0F) << 1);
    bytes.push(ssid_byte);
}

fn push_flag(bits: &mut Vec<u8>) {
    // 0x7E = 01111110 (LSB first)
    let flag: [u8; 8] = [0, 1, 1, 1, 1, 1, 1, 0];
    bits.extend_from_slice(&flag);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_frame() {
        let src = Callsign { call: "N0CALL".to_string(), ssid: 0 };
        let dst = Callsign { call: "APRS".to_string(), ssid: 0 };
        let frame = build_ui_frame(&src, &dst, &[], b"!4903.50N/07201.75W-Test");
        assert!(frame.len() > 16);
    }

    #[test]
    fn hdlc_adds_flags() {
        let frame = vec![0x03, 0xF0, 0x41]; // minimal
        let bits = hdlc_encode(&frame);
        // Should start and end with flag (01111110)
        assert_eq!(&bits[0..8], &[0, 1, 1, 1, 1, 1, 1, 0]);
    }

    #[test]
    fn nrzi_basic() {
        let input = [0, 1, 1, 0, 1];
        let output = nrzi_encode(&input);
        assert_eq!(output.len(), 5);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/ax25/encode.rs crates/mayhem-protocols/src/ax25/mod.rs
git commit -m "mayhem-protocols: AX.25 frame encoder (HDLC + bit-stuffing + NRZI)"
```

---

## Task 5: AFSK modulator + FM modulator DSP blocks

**Files:**
- Create: `crates/mayhem-dsp/src/afsk_mod.rs`
- Create: `crates/mayhem-dsp/src/fm_mod.rs`
- Create: `crates/mayhem-dsp/src/cw_keyer.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement AFSK modulator**

```rust
//! AFSK modulator: converts NRZ bits to mark/space audio tones.
//! Output is f32 audio suitable for FM modulation onto a carrier.

use std::f32::consts::PI;

/// Generate AFSK audio from NRZI-encoded bit sequence.
pub fn afsk_modulate(bits: &[u8], mark_hz: f32, space_hz: f32, baud: f32, sample_rate: f32) -> Vec<f32> {
    let samples_per_bit = (sample_rate / baud).round() as usize;
    let mut audio = Vec::with_capacity(bits.len() * samples_per_bit);
    let mut phase = 0.0f32;

    for &bit in bits {
        let freq = if bit == 1 { mark_hz } else { space_hz };
        let phase_inc = 2.0 * PI * freq / sample_rate;
        for _ in 0..samples_per_bit {
            audio.push(phase.sin());
            phase += phase_inc;
            if phase > PI { phase -= 2.0 * PI; }
        }
    }

    audio
}
```

- [ ] **Step 2: Implement FM modulator**

```rust
//! FM modulator: audio → Complex IQ at baseband.
//! Converts f32 audio samples to frequency-modulated IQ.

use futuresdr::num_complex::Complex32;
use std::f32::consts::PI;

/// FM modulate audio samples to IQ.
pub fn fm_modulate(audio: &[f32], deviation_hz: f32, sample_rate: f32) -> Vec<Complex32> {
    let mut iq = Vec::with_capacity(audio.len());
    let mut phase = 0.0f32;

    for &sample in audio {
        let phase_inc = 2.0 * PI * deviation_hz * sample / sample_rate;
        phase += phase_inc;
        if phase > PI { phase -= 2.0 * PI; }
        if phase < -PI { phase += 2.0 * PI; }
        iq.push(Complex32::new(phase.cos(), phase.sin()));
    }

    iq
}
```

- [ ] **Step 3: Implement CW keyer**

```rust
//! CW keyer: generates IQ for on/off keying with raised-cosine edges.

use futuresdr::num_complex::Complex32;
use std::f32::consts::PI;

/// Generate CW IQ from keying sequence.
/// Each element is (key_down, duration_samples).
/// Raised-cosine edges prevent key clicks.
pub fn cw_generate(keying: &[(bool, usize)], tone_hz: f32, sample_rate: f32, rise_time_ms: f32) -> Vec<Complex32> {
    let rise_samples = (rise_time_ms * sample_rate / 1000.0).round() as usize;
    let total_samples: usize = keying.iter().map(|(_, d)| *d).sum();
    let mut iq = Vec::with_capacity(total_samples);
    let mut phase = 0.0f32;
    let phase_inc = 2.0 * PI * tone_hz / sample_rate;

    for &(key_down, duration) in keying {
        for i in 0..duration {
            let envelope = if key_down {
                if i < rise_samples {
                    0.5 * (1.0 - (PI * i as f32 / rise_samples as f32).cos())
                } else if i >= duration - rise_samples {
                    let j = duration - i;
                    0.5 * (1.0 - (PI * j as f32 / rise_samples as f32).cos())
                } else {
                    1.0
                }
            } else {
                0.0
            };

            let sample = Complex32::new(phase.cos(), phase.sin()) * envelope;
            iq.push(sample);
            phase += phase_inc;
            if phase > PI { phase -= 2.0 * PI; }
        }
    }

    iq
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cw_silence_when_key_up() {
        let keying = vec![(false, 100)];
        let iq = cw_generate(&keying, 700.0, 48000.0, 5.0);
        assert_eq!(iq.len(), 100);
        for s in &iq {
            assert_eq!(s.norm(), 0.0);
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/afsk_mod.rs crates/mayhem-dsp/src/fm_mod.rs crates/mayhem-dsp/src/cw_keyer.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: AFSK modulator, FM modulator, CW keyer with raised-cosine edges"
```

---

## Task 6: IPC types for Phase 5 apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and param types**

```rust
// AppIds:
RttyTx, SstvTx, AfskTx, MorseTx, SoundboardTx, FlexTx,

// Param types:
pub struct RttyTxParams { pub text: String, pub baud: f32, pub shift_hz: f32, pub center_hz: f64, pub vga_gain_db: u32, pub amp_enabled: bool }
pub struct SstvTxParams { pub image_path: String, pub mode: String, pub center_hz: f64, pub vga_gain_db: u32, pub amp_enabled: bool }
pub struct AfskTxParams { pub packet: String, pub src_call: String, pub dst_call: String, pub center_hz: f64, pub vga_gain_db: u32, pub amp_enabled: bool }
pub struct MorseTxParams { pub text: String, pub wpm: f32, pub tone_hz: f32, pub center_hz: f64, pub vga_gain_db: u32, pub amp_enabled: bool }
pub struct SoundboardTxParams { pub audio_path: String, pub deviation_hz: f32, pub center_hz: f64, pub vga_gain_db: u32, pub amp_enabled: bool }
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 5 amateur TX app IDs and parameter types"
```

---

## Task 7: App implementations (all 6 Phase 5 apps)

**Files:**
- Create: `crates/mayhem-apps/src/rtty_tx.rs`
- Create: `crates/mayhem-apps/src/sstv_tx.rs`
- Create: `crates/mayhem-apps/src/afsk_tx.rs`
- Create: `crates/mayhem-apps/src/morse_tx.rs`
- Create: `crates/mayhem-apps/src/soundboard_tx.rs`
- Create: `crates/mayhem-apps/src/flex_tx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement app skeletons**

Each follows the POCSAG TX pattern (one-shot TX):
- RTTY: Text → Baudot → FSK modulate → HackRF sink.
- SSTV: Image → SSTV freq sequence → FM modulate → HackRF sink.
- AFSK TX: Packet → AX.25 encode → HDLC → NRZI → AFSK → FM → HackRF sink.
- Morse: Text → Morse timing → CW keyer → HackRF sink.
- Soundboard: Load audio file → FM modulate → HackRF sink.
- FLEX: Message → FLEX frame encode → 2/4-FSK → HackRF sink.

All are RegulatoryClass::AmateurOnly.

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/rtty_tx.rs crates/mayhem-apps/src/sstv_tx.rs crates/mayhem-apps/src/afsk_tx.rs crates/mayhem-apps/src/morse_tx.rs crates/mayhem-apps/src/soundboard_tx.rs crates/mayhem-apps/src/flex_tx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: Phase 5 amateur TX app skeletons (RTTY, SSTV, AFSK, Morse, Soundboard, FLEX)"
```

---

## Task 8: Runner registration + frontend components

**Files:**
- Modify: `src-tauri/src/runner.rs`
- Create: `frontend/src/apps/rtty-tx/RttyTxApp.tsx`
- Create: `frontend/src/apps/sstv-tx/SstvTxApp.tsx`
- Create: `frontend/src/apps/afsk-tx/AfskTxApp.tsx`
- Create: `frontend/src/apps/morse-tx/MorseTxApp.tsx`
- Create: `frontend/src/apps/soundboard-tx/SoundboardTxApp.tsx`
- Create: `frontend/src/apps/flex-tx/FlexTxApp.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Register in runner**

- [ ] **Step 2: Implement frontend components**

- RTTY: Text input, baud/shift selector, TX progress.
- SSTV: Image picker, mode selector, preview at target resolution, progress bar.
- AFSK: APRS message builder (position/status), or raw packet input.
- Morse: Text input, WPM slider, sidetone audio preview button, TX button.
- Soundboard: Audio clip grid (load clips), frequency input, TX on click.
- FLEX: Address + message + speed selector.

All include arm/disarm + legal banner (reuse existing components).

- [ ] **Step 3: Add to switcher**

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/runner.rs frontend/src/apps/rtty-tx/ frontend/src/apps/sstv-tx/ frontend/src/apps/afsk-tx/ frontend/src/apps/morse-tx/ frontend/src/apps/soundboard-tx/ frontend/src/apps/flex-tx/ frontend/src/App.tsx
git commit -m "Phase 5 integration: runner, 6 TX frontend components, switcher"
```

---

## Task 9: Protocol encoder tests

**Files:**
- Create: `crates/mayhem-protocols/tests/phase5_encoders.rs`

- [ ] **Step 1: Test Baudot, Morse, SSTV, AX.25 encode**

- Baudot: encode "HELLO 123" → verify shift insertion.
- Morse: encode "SOS" → verify dit/dah pattern.
- SSTV: encode small image → verify frequency range [1100, 2300] Hz.
- AX.25: build frame → verify CRC, flags, bit-stuffing.

- [ ] **Step 2: Commit**

```bash
cargo test -p mayhem-protocols -- phase5
git add crates/mayhem-protocols/tests/phase5_encoders.rs
git commit -m "test: Phase 5 protocol encoder tests (Baudot, Morse, SSTV, AX.25)"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | Baudot encoder | Shift handling, NRZ bits, tests pass |
| 2 | Morse encoder | ITU patterns, Farnsworth, keying output |
| 3 | SSTV encoder | Robot 36 image→freq, range [1100,2300] |
| 4 | AX.25 encoder | Frame build, HDLC, bit-stuff, NRZI |
| 5 | DSP modulators | AFSK, FM, CW keyer all compile |
| 6 | IPC types | 6 AppIds + TX param types |
| 7 | App skeletons | All 6 compile, AmateurOnly metadata |
| 8 | Runner + frontend | Registered, components render |
| 9 | Encoder tests | All protocol tests pass |
