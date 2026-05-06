# Mayhem PC Phase 2a — FM-Digital Protocols: APRS, AIS, ACARS, POCSAG RX, AFSK RX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first 5 FM-family digital protocol apps: APRS RX, AIS RX, ACARS RX, POCSAG RX, and generic AFSK RX. These share AFSK/FSK demodulation and AX.25 framing building blocks.

**Architecture:** New shared DSP blocks (AFSK demod, FSK slicer) in `mayhem-dsp`. New protocol decoders (AX.25, APRS, AIS, ACARS, POCSAG decode) in `mayhem-protocols`. Each app composes a flowgraph using these blocks.

**Spec reference:** `docs/superpowers/phase-specs/phase-2-fm-digital.md`

**Out of scope:** ERT, weather stations, radiosondes, two-tone pager, FLEX (covered in Phase 2b).

---

## File structure produced by this plan

```
crates/mayhem-dsp/src/
├── afsk_demod.rs                  # AFSK mark/space demodulator (Bell 202 + configurable)
├── fsk_slicer.rs                  # Generalized multi-level FSK symbol slicer
├── gmsk_demod.rs                  # GMSK demodulator (for AIS)
└── lib.rs                         # add new exports

crates/mayhem-protocols/src/
├── ax25/
│   ├── mod.rs
│   └── frame.rs                   # AX.25 HDLC decode (flag, unstuff, CRC-16)
├── aprs/
│   ├── mod.rs
│   └── parse.rs                   # APRS payload parser (position, status, message)
├── ais/
│   ├── mod.rs
│   ├── decode.rs                  # AIS message type decode (1-5, 18, 24)
│   └── nmea.rs                    # NMEA sentence assembly
├── acars/
│   ├── mod.rs
│   └── decode.rs                  # ACARS frame decode
└── lib.rs                         # add module exports

crates/mayhem-apps/src/
├── aprs_rx.rs
├── ais_rx.rs
├── acars_rx.rs
├── pocsag_rx.rs
├── afsk_rx.rs
└── lib.rs

crates/mayhem-ipc/src/lib.rs      # new AppId variants + event types

frontend/src/apps/
├── aprs-rx/AprsRxApp.tsx
├── ais-rx/AisRxApp.tsx
├── acars-rx/AcarsRxApp.tsx
├── pocsag-rx/PocsagRxApp.tsx
└── afsk-rx/AfskRxApp.tsx
```

---

## Task 1: AFSK demodulator DSP block

**Why first:** Core building block for APRS, ACARS, and generic AFSK. Bell 202 (1200/2200 Hz, 1200 baud) is the primary configuration.

**Files:**
- Create: `crates/mayhem-dsp/src/afsk_demod.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement afsk_demod.rs**

```rust
//! AFSK demodulator using correlation (Goertzel-based mark/space energy comparison).
//!
//! Input: f32 audio samples (after FM demod).
//! Output: u8 symbols (0 or 1) at the configured baud rate.
//!
//! Default config: Bell 202 (mark=1200 Hz, space=2200 Hz, baud=1200).

use futuresdr::anyhow::Result;
use futuresdr::runtime::Block;
use futuresdr::runtime::BlockMeta;
use futuresdr::runtime::BlockMetaBuilder;
use futuresdr::runtime::Kernel;
use futuresdr::runtime::MessageIo;
use futuresdr::runtime::MessageIoBuilder;
use futuresdr::runtime::StreamIo;
use futuresdr::runtime::StreamIoBuilder;
use futuresdr::runtime::WorkIo;
use std::f32::consts::PI;

pub struct AfskDemod {
    mark_hz: f32,
    space_hz: f32,
    baud_rate: f32,
    sample_rate: f32,
    samples_per_symbol: usize,
    sample_count: usize,
    // Goertzel state for mark and space
    mark_coeff: f32,
    space_coeff: f32,
    mark_s1: f32,
    mark_s2: f32,
    space_s1: f32,
    space_s2: f32,
}

impl AfskDemod {
    pub fn new(mark_hz: f32, space_hz: f32, baud_rate: f32, sample_rate: f32) -> Block {
        let samples_per_symbol = (sample_rate / baud_rate).round() as usize;
        let mark_coeff = 2.0 * (2.0 * PI * mark_hz / sample_rate * samples_per_symbol as f32).cos();
        let space_coeff = 2.0 * (2.0 * PI * space_hz / sample_rate * samples_per_symbol as f32).cos();

        Block::new(
            BlockMetaBuilder::new("AfskDemod").build(),
            StreamIoBuilder::new()
                .add_input::<f32>("in")
                .add_output::<u8>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                mark_hz,
                space_hz,
                baud_rate,
                sample_rate,
                samples_per_symbol,
                sample_count: 0,
                mark_coeff,
                space_coeff,
                mark_s1: 0.0,
                mark_s2: 0.0,
                space_s1: 0.0,
                space_s2: 0.0,
            },
        )
    }

    /// Bell 202 standard: 1200 Hz mark, 2200 Hz space, 1200 baud.
    pub fn bell_202(sample_rate: f32) -> Block {
        Self::new(1200.0, 2200.0, 1200.0, sample_rate)
    }

    fn goertzel_mag_sq(s1: f32, s2: f32, coeff: f32) -> f32 {
        s1 * s1 + s2 * s2 - coeff * s1 * s2
    }
}

#[async_trait::async_trait]
impl Kernel for AfskDemod {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<f32>();
        let output = sio.output(0).slice::<u8>();

        if input.is_empty() {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        let mut in_idx = 0;
        let mut out_idx = 0;

        while in_idx < input.len() && out_idx < output.len() {
            let sample = input[in_idx];
            in_idx += 1;

            // Feed Goertzel filters
            let mark_s0 = sample + self.mark_coeff * self.mark_s1 - self.mark_s2;
            self.mark_s2 = self.mark_s1;
            self.mark_s1 = mark_s0;

            let space_s0 = sample + self.space_coeff * self.space_s1 - self.space_s2;
            self.space_s2 = self.space_s1;
            self.space_s1 = space_s0;

            self.sample_count += 1;

            if self.sample_count >= self.samples_per_symbol {
                // Compute energies and decide
                let mark_energy = Self::goertzel_mag_sq(self.mark_s1, self.mark_s2, self.mark_coeff);
                let space_energy = Self::goertzel_mag_sq(self.space_s1, self.space_s2, self.space_coeff);

                output[out_idx] = if mark_energy > space_energy { 1 } else { 0 };
                out_idx += 1;

                // Reset
                self.mark_s1 = 0.0;
                self.mark_s2 = 0.0;
                self.space_s1 = 0.0;
                self.space_s2 = 0.0;
                self.sample_count = 0;
            }
        }

        sio.input(0).consume(in_idx);
        sio.output(0).produce(out_idx);

        if sio.input(0).finished() && in_idx == input.len() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bell_202_creates() {
        let _block = AfskDemod::bell_202(48000.0);
    }

    #[test]
    fn custom_config_creates() {
        let _block = AfskDemod::new(1200.0, 1800.0, 1200.0, 22050.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs**

Add `pub mod afsk_demod;` to `crates/mayhem-dsp/src/lib.rs`.

- [ ] **Step 3: Verify and commit**

```bash
cargo check -p mayhem-dsp
git add crates/mayhem-dsp/src/afsk_demod.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: AFSK demodulator (Goertzel-based, Bell 202 default)"
```

---

## Task 2: Generalized FSK symbol slicer

**Why:** Used by POCSAG RX, FLEX, and other FSK protocols. Extends the concept from Phase 0's POCSAG encoder (which works on bits) to a general-purpose demod output slicer.

**Files:**
- Create: `crates/mayhem-dsp/src/fsk_slicer.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement fsk_slicer.rs**

```rust
//! Generalized FSK symbol slicer.
//!
//! Input: f32 (FM-demodulated baseband — instantaneous frequency deviation).
//! Output: u8 symbols (0/1 for 2-FSK, 0-3 for 4-FSK).
//!
//! Performs clock recovery (early-late gate) and threshold slicing.

use futuresdr::anyhow::Result;
use futuresdr::runtime::Block;
use futuresdr::runtime::BlockMeta;
use futuresdr::runtime::BlockMetaBuilder;
use futuresdr::runtime::Kernel;
use futuresdr::runtime::MessageIo;
use futuresdr::runtime::MessageIoBuilder;
use futuresdr::runtime::StreamIo;
use futuresdr::runtime::StreamIoBuilder;
use futuresdr::runtime::WorkIo;

pub struct FskSlicer {
    levels: u8, // 2 or 4
    samples_per_symbol: f32,
    mu: f32,            // fractional symbol timing offset
    gain_mu: f32,       // timing recovery loop gain
    last_sample: f32,
    sample_count: f32,
}

impl FskSlicer {
    /// Create a 2-FSK slicer.
    pub fn two_level(baud_rate: f32, sample_rate: f32) -> Block {
        Self::new(2, baud_rate, sample_rate)
    }

    /// Create a 4-FSK slicer.
    pub fn four_level(baud_rate: f32, sample_rate: f32) -> Block {
        Self::new(4, baud_rate, sample_rate)
    }

    fn new(levels: u8, baud_rate: f32, sample_rate: f32) -> Block {
        let samples_per_symbol = sample_rate / baud_rate;
        Block::new(
            BlockMetaBuilder::new("FskSlicer").build(),
            StreamIoBuilder::new()
                .add_input::<f32>("in")
                .add_output::<u8>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                levels,
                samples_per_symbol,
                mu: 0.0,
                gain_mu: 0.01,
                last_sample: 0.0,
                sample_count: 0.0,
            },
        )
    }

    fn slice_2fsk(sample: f32) -> u8 {
        if sample >= 0.0 { 1 } else { 0 }
    }

    fn slice_4fsk(sample: f32) -> u8 {
        // Thresholds at -0.67, 0, +0.67 (normalized)
        if sample > 0.33 {
            3
        } else if sample > 0.0 {
            2
        } else if sample > -0.33 {
            1
        } else {
            0
        }
    }
}

#[async_trait::async_trait]
impl Kernel for FskSlicer {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<f32>();
        let output = sio.output(0).slice::<u8>();

        if input.is_empty() {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        let mut in_idx = 0;
        let mut out_idx = 0;

        while in_idx < input.len() && out_idx < output.len() {
            let sample = input[in_idx];
            in_idx += 1;
            self.sample_count += 1.0;

            if self.sample_count >= self.samples_per_symbol + self.mu {
                // Symbol decision point
                let symbol = match self.levels {
                    4 => Self::slice_4fsk(sample),
                    _ => Self::slice_2fsk(sample),
                };
                output[out_idx] = symbol;
                out_idx += 1;

                // Simple timing recovery: early-late
                let timing_error = (sample - self.last_sample).abs();
                self.mu += self.gain_mu * timing_error;
                self.mu = self.mu.clamp(-0.5, 0.5);
                self.sample_count = 0.0;
            }
            self.last_sample = sample;
        }

        sio.input(0).consume(in_idx);
        sio.output(0).produce(out_idx);

        if sio.input(0).finished() && in_idx == input.len() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_fsk_creates() {
        let _block = FskSlicer::two_level(1200.0, 48000.0);
    }

    #[test]
    fn four_fsk_creates() {
        let _block = FskSlicer::four_level(1600.0, 48000.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-dsp/src/fsk_slicer.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: generalized FSK symbol slicer (2/4-level, clock recovery)"
```

---

## Task 3: AX.25 frame decoder (mayhem-protocols)

**Why:** Core protocol layer for APRS. Decodes HDLC framing used by amateur packet radio.

**Files:**
- Create: `crates/mayhem-protocols/src/ax25/mod.rs`
- Create: `crates/mayhem-protocols/src/ax25/frame.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement AX.25 decoder**

Create `crates/mayhem-protocols/src/ax25/mod.rs`:
```rust
pub mod frame;
pub use frame::{Ax25Frame, decode_ax25};
```

Create `crates/mayhem-protocols/src/ax25/frame.rs`:
```rust
//! AX.25 HDLC frame decoder.
//!
//! Input: NRZI-decoded bit stream (after AFSK demod).
//! Output: Decoded frames with source/dest callsigns and payload.

use thiserror::Error;

#[derive(Debug, Clone)]
pub struct Ax25Frame {
    pub dst: Callsign,
    pub src: Callsign,
    pub digipeaters: Vec<Callsign>,
    pub control: u8,
    pub pid: u8,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct Callsign {
    pub call: String,  // up to 6 chars
    pub ssid: u8,      // 0-15
}

impl std::fmt::Display for Callsign {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.ssid == 0 {
            write!(f, "{}", self.call)
        } else {
            write!(f, "{}-{}", self.call, self.ssid)
        }
    }
}

#[derive(Debug, Error)]
pub enum Ax25Error {
    #[error("frame too short ({0} bytes)")]
    TooShort(usize),
    #[error("CRC mismatch")]
    CrcMismatch,
    #[error("invalid address field")]
    InvalidAddress,
}

/// Decode an AX.25 frame from raw bytes (after HDLC flag removal and bit-unstuffing).
/// The input should NOT include the 0x7E flags but SHOULD include the 2-byte FCS.
pub fn decode_ax25(data: &[u8]) -> Result<Ax25Frame, Ax25Error> {
    if data.len() < 16 {
        return Err(Ax25Error::TooShort(data.len()));
    }

    // Verify FCS (CRC-16/CCITT, same as CRC-16/X.25)
    let fcs_calc = crc16_ccitt(&data[..data.len() - 2]);
    let fcs_recv = u16::from_le_bytes([data[data.len() - 2], data[data.len() - 1]]);
    if fcs_calc != fcs_recv {
        return Err(Ax25Error::CrcMismatch);
    }

    let payload_data = &data[..data.len() - 2]; // strip FCS

    // Parse address fields (7 bytes each: 6 callsign + 1 SSID)
    let dst = parse_callsign(&payload_data[0..7])?;
    let src = parse_callsign(&payload_data[7..14])?;

    let mut offset = 14;
    let mut digipeaters = Vec::new();

    // Check if address extension bit is set (bit 0 of last byte = 1 means end)
    while offset < payload_data.len() && (payload_data[offset - 1] & 0x01) == 0 {
        if offset + 7 > payload_data.len() {
            break;
        }
        digipeaters.push(parse_callsign(&payload_data[offset..offset + 7])?);
        offset += 7;
    }

    if offset + 2 > payload_data.len() {
        return Err(Ax25Error::TooShort(payload_data.len()));
    }

    let control = payload_data[offset];
    let pid = payload_data[offset + 1];
    let payload = payload_data[offset + 2..].to_vec();

    Ok(Ax25Frame {
        dst,
        src,
        digipeaters,
        control,
        pid,
        payload,
    })
}

fn parse_callsign(data: &[u8]) -> Result<Callsign, Ax25Error> {
    if data.len() < 7 {
        return Err(Ax25Error::InvalidAddress);
    }
    let call: String = data[0..6]
        .iter()
        .map(|&b| (b >> 1) as char)
        .collect::<String>()
        .trim()
        .to_string();
    let ssid = (data[6] >> 1) & 0x0F;
    Ok(Callsign { call, ssid })
}

/// CRC-16/CCITT (polynomial 0x8408, init 0xFFFF, final XOR 0xFFFF).
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

/// NRZI decode: convert NRZI bit stream to NRZ.
/// In NRZI, a '0' bit is a transition, '1' is no transition.
pub fn nrzi_decode(bits: &[u8]) -> Vec<u8> {
    let mut result = Vec::with_capacity(bits.len());
    let mut last = 0u8;
    for &bit in bits {
        let decoded = if bit == last { 1 } else { 0 };
        last = bit;
        result.push(decoded);
    }
    result
}

/// Remove bit-stuffing: after 5 consecutive 1s, a 0 is removed.
/// Also detects flags (0x7E = 01111110) and returns frame bytes between flags.
pub fn hdlc_unstuff(bits: &[u8]) -> Vec<Vec<u8>> {
    let mut frames = Vec::new();
    let mut current_frame_bits: Vec<u8> = Vec::new();
    let mut ones_count = 0;
    let mut in_frame = false;

    for &bit in bits {
        if ones_count == 6 {
            if bit == 0 {
                // Flag detected (01111110)
                if in_frame && current_frame_bits.len() >= 8 * 16 {
                    // Convert bits to bytes
                    let bytes = bits_to_bytes(&current_frame_bits);
                    frames.push(bytes);
                }
                current_frame_bits.clear();
                in_frame = true;
                ones_count = 0;
                continue;
            } else {
                // Abort (7+ ones)
                current_frame_bits.clear();
                in_frame = false;
                ones_count += 1;
                continue;
            }
        }

        if bit == 1 {
            ones_count += 1;
            if in_frame {
                current_frame_bits.push(1);
            }
        } else {
            if ones_count == 5 {
                // Stuffed bit — discard
                ones_count = 0;
                continue;
            }
            ones_count = 0;
            if in_frame {
                current_frame_bits.push(0);
            }
        }
    }

    frames
}

fn bits_to_bytes(bits: &[u8]) -> Vec<u8> {
    bits.chunks(8)
        .filter(|chunk| chunk.len() == 8)
        .map(|chunk| {
            let mut byte = 0u8;
            for (i, &bit) in chunk.iter().enumerate() {
                byte |= bit << i; // LSB first
            }
            byte
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nrzi_decode_basic() {
        // Same = 1, transition = 0
        let input = [0, 0, 0, 1, 1, 0];
        let decoded = nrzi_decode(&input);
        assert_eq!(decoded, [1, 1, 1, 0, 1, 0]); // first is arbitrary
    }

    #[test]
    fn crc16_known_vector() {
        // "123456789" should give a known CRC
        let data = b"123456789";
        let crc = crc16_ccitt(data);
        // CRC-16/CCITT (X.25 variant, init=FFFF, xor=FFFF) of "123456789" = 0x906E
        assert_eq!(crc, 0x906E);
    }
}
```

- [ ] **Step 2: Update lib.rs and commit**

```bash
git add crates/mayhem-protocols/src/ax25/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: AX.25 HDLC decoder (NRZI, unstuff, CRC-16, frame parse)"
```

---

## Task 4: APRS payload parser

**Files:**
- Create: `crates/mayhem-protocols/src/aprs/mod.rs`
- Create: `crates/mayhem-protocols/src/aprs/parse.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement APRS parser**

```rust
//! APRS payload parser. Extracts position, status, and message from AX.25 info field.
//!
//! Reference: APRS Protocol Reference (APRS101.pdf).

#[derive(Debug, Clone)]
pub enum AprsPacket {
    Position(AprsPosition),
    Status(String),
    Message { addressee: String, text: String, id: Option<String> },
    Other(String),
}

#[derive(Debug, Clone)]
pub struct AprsPosition {
    pub lat: f64,
    pub lon: f64,
    pub symbol_table: char,
    pub symbol_code: char,
    pub comment: String,
    pub altitude_ft: Option<i32>,
    pub speed_kt: Option<f64>,
    pub course_deg: Option<f64>,
}

/// Parse APRS info field (the AX.25 payload after PID byte).
pub fn parse_aprs(info: &[u8]) -> AprsPacket {
    if info.is_empty() {
        return AprsPacket::Other(String::new());
    }

    match info[0] as char {
        '!' | '=' => parse_position_uncompressed(info),
        '/' | '@' => parse_position_with_timestamp(info),
        '>' => AprsPacket::Status(String::from_utf8_lossy(&info[1..]).to_string()),
        ':' => parse_message(info),
        _ => AprsPacket::Other(String::from_utf8_lossy(info).to_string()),
    }
}

fn parse_position_uncompressed(info: &[u8]) -> AprsPacket {
    // Format: !DDMM.MMN/DDDMM.MMW$... (where $ is symbol code)
    if info.len() < 20 {
        return AprsPacket::Other(String::from_utf8_lossy(info).to_string());
    }
    let s = String::from_utf8_lossy(info);

    let lat_str = &s[1..9];   // DDMM.MMN
    let sym_table = s.chars().nth(9).unwrap_or('/');
    let lon_str = &s[10..19]; // DDDMM.MMW
    let sym_code = s.chars().nth(19).unwrap_or('/');
    let comment = if s.len() > 20 { s[20..].to_string() } else { String::new() };

    let lat = parse_lat(lat_str).unwrap_or(0.0);
    let lon = parse_lon(lon_str).unwrap_or(0.0);

    AprsPacket::Position(AprsPosition {
        lat,
        lon,
        symbol_table,
        symbol_code,
        comment,
        altitude_ft: None,
        speed_kt: None,
        course_deg: None,
    })
}

fn parse_position_with_timestamp(info: &[u8]) -> AprsPacket {
    // Format: /DDHHMM[z|h|/]DDMM.MMN/DDDMM.MMW$...
    if info.len() < 27 {
        return AprsPacket::Other(String::from_utf8_lossy(info).to_string());
    }
    let s = String::from_utf8_lossy(info);
    // Skip timestamp (7 chars after type byte)
    let rest = &s[8..];
    let lat_str = &rest[0..8];
    let sym_table = rest.chars().nth(8).unwrap_or('/');
    let lon_str = &rest[9..18];
    let sym_code = rest.chars().nth(18).unwrap_or('/');
    let comment = if rest.len() > 19 { rest[19..].to_string() } else { String::new() };

    let lat = parse_lat(lat_str).unwrap_or(0.0);
    let lon = parse_lon(lon_str).unwrap_or(0.0);

    AprsPacket::Position(AprsPosition {
        lat, lon, symbol_table, symbol_code, comment,
        altitude_ft: None, speed_kt: None, course_deg: None,
    })
}

fn parse_message(info: &[u8]) -> AprsPacket {
    let s = String::from_utf8_lossy(&info[1..]);
    if let Some(colon_pos) = s.find(':') {
        let addressee = s[..colon_pos].trim().to_string();
        let rest = &s[colon_pos + 1..];
        let (text, id) = if let Some(brace) = rest.rfind('{') {
            (rest[..brace].to_string(), Some(rest[brace + 1..].to_string()))
        } else {
            (rest.to_string(), None)
        };
        AprsPacket::Message { addressee, text, id }
    } else {
        AprsPacket::Other(s.to_string())
    }
}

fn parse_lat(s: &str) -> Option<f64> {
    if s.len() < 8 { return None; }
    let deg: f64 = s[0..2].parse().ok()?;
    let min: f64 = s[2..7].parse().ok()?;
    let dir = s.chars().nth(7)?;
    let mut lat = deg + min / 60.0;
    if dir == 'S' { lat = -lat; }
    Some(lat)
}

fn parse_lon(s: &str) -> Option<f64> {
    if s.len() < 9 { return None; }
    let deg: f64 = s[0..3].parse().ok()?;
    let min: f64 = s[3..8].parse().ok()?;
    let dir = s.chars().nth(8)?;
    let mut lon = deg + min / 60.0;
    if dir == 'W' { lon = -lon; }
    Some(lon)
}
```

- [ ] **Step 2: Tests and commit**

```bash
cargo test -p mayhem-protocols -- aprs
git add crates/mayhem-protocols/src/aprs/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: APRS payload parser (position, status, message)"
```

---

## Task 5: AIS protocol decoder

**Files:**
- Create: `crates/mayhem-protocols/src/ais/mod.rs`
- Create: `crates/mayhem-protocols/src/ais/decode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement AIS decoder (message types 1-5, 18, 24)**

```rust
//! AIS (Automatic Identification System) message decoder.
//! Decodes the 6-bit ASCII payload from AIVDM/AIVDO sentences.

#[derive(Debug, Clone)]
pub enum AisMessage {
    PositionReport(AisPosition),   // Types 1, 2, 3
    StaticVoyage(AisStatic),       // Type 5
    ClassBPosition(AisPosition),   // Type 18
    ClassBStatic(AisClassBStatic), // Type 24
    Unknown { msg_type: u8 },
}

#[derive(Debug, Clone)]
pub struct AisPosition {
    pub mmsi: u32,
    pub status: u8,
    pub speed_knots: f64,    // 0.1 knot resolution
    pub lon: f64,            // degrees, 1/10000 minute resolution
    pub lat: f64,
    pub course: f64,         // 0.1 degree resolution
    pub heading: u16,        // degrees, 511 = not available
    pub timestamp: u8,       // second of UTC minute
}

#[derive(Debug, Clone)]
pub struct AisStatic {
    pub mmsi: u32,
    pub imo: u32,
    pub callsign: String,
    pub name: String,
    pub ship_type: u8,
    pub destination: String,
}

#[derive(Debug, Clone)]
pub struct AisClassBStatic {
    pub mmsi: u32,
    pub name: String,
    pub ship_type: u8,
    pub callsign: String,
}

/// Decode AIS message from bit vector (after 6-bit ASCII → binary conversion).
pub fn decode_ais(bits: &[bool]) -> Option<AisMessage> {
    if bits.len() < 38 { return None; }
    let msg_type = extract_uint(bits, 0, 6) as u8;
    let mmsi = extract_uint(bits, 8, 30) as u32;

    match msg_type {
        1 | 2 | 3 => decode_position_report(bits, mmsi),
        5 => decode_static_voyage(bits, mmsi),
        18 => decode_class_b_position(bits, mmsi),
        24 => decode_class_b_static(bits, mmsi),
        _ => Some(AisMessage::Unknown { msg_type }),
    }
}

fn decode_position_report(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 168 { return None; }
    let status = extract_uint(bits, 38, 4) as u8;
    let rot = extract_int(bits, 42, 8);
    let speed = extract_uint(bits, 50, 10) as f64 / 10.0;
    let lon = extract_int(bits, 61, 28) as f64 / 600000.0;
    let lat = extract_int(bits, 89, 27) as f64 / 600000.0;
    let course = extract_uint(bits, 116, 12) as f64 / 10.0;
    let heading = extract_uint(bits, 128, 9) as u16;
    let timestamp = extract_uint(bits, 137, 6) as u8;

    Some(AisMessage::PositionReport(AisPosition {
        mmsi, status, speed_knots: speed, lon, lat, course, heading, timestamp,
    }))
}

fn decode_static_voyage(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 424 { return None; }
    let imo = extract_uint(bits, 40, 30) as u32;
    let callsign = extract_string(bits, 70, 42);
    let name = extract_string(bits, 112, 120);
    let ship_type = extract_uint(bits, 232, 8) as u8;
    let destination = extract_string(bits, 302, 120);

    Some(AisMessage::StaticVoyage(AisStatic {
        mmsi, imo, callsign, name, ship_type, destination,
    }))
}

fn decode_class_b_position(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 168 { return None; }
    let speed = extract_uint(bits, 46, 10) as f64 / 10.0;
    let lon = extract_int(bits, 57, 28) as f64 / 600000.0;
    let lat = extract_int(bits, 85, 27) as f64 / 600000.0;
    let course = extract_uint(bits, 112, 12) as f64 / 10.0;
    let heading = extract_uint(bits, 124, 9) as u16;
    let timestamp = extract_uint(bits, 133, 6) as u8;

    Some(AisMessage::ClassBPosition(AisPosition {
        mmsi, status: 15, speed_knots: speed, lon, lat, course, heading, timestamp,
    }))
}

fn decode_class_b_static(bits: &[bool], mmsi: u32) -> Option<AisMessage> {
    if bits.len() < 160 { return None; }
    let name = extract_string(bits, 40, 120);
    let ship_type = extract_uint(bits, 40 + 120, 8) as u8;
    let callsign = extract_string(bits, 40 + 120 + 48, 42);

    Some(AisMessage::ClassBStatic(AisClassBStatic {
        mmsi, name, ship_type, callsign,
    }))
}

fn extract_uint(bits: &[bool], start: usize, len: usize) -> u64 {
    let mut val = 0u64;
    for i in 0..len {
        if start + i < bits.len() && bits[start + i] {
            val |= 1 << (len - 1 - i);
        }
    }
    val
}

fn extract_int(bits: &[bool], start: usize, len: usize) -> i64 {
    let val = extract_uint(bits, start, len);
    // Sign extension
    if val & (1 << (len - 1)) != 0 {
        val as i64 | (!0i64 << len)
    } else {
        val as i64
    }
}

fn extract_string(bits: &[bool], start: usize, bit_len: usize) -> String {
    let mut s = String::new();
    for i in (0..bit_len).step_by(6) {
        let ch = extract_uint(bits, start + i, 6) as u8;
        let ascii = if ch < 32 { ch + 64 } else { ch };
        if ascii == b'@' { break; } // @ is padding
        s.push(ascii as char);
    }
    s.trim().to_string()
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/ais/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: AIS decoder (msg types 1-5, 18, 24)"
```

---

## Task 6: ACARS frame decoder

**Files:**
- Create: `crates/mayhem-protocols/src/acars/mod.rs`
- Create: `crates/mayhem-protocols/src/acars/decode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement ACARS decoder**

```rust
//! ACARS (Aircraft Communications Addressing and Reporting System) frame decoder.

#[derive(Debug, Clone)]
pub struct AcarsMessage {
    pub mode: char,           // Mode character
    pub reg: String,          // Aircraft registration (7 chars)
    pub ack: char,            // Acknowledge character
    pub label: String,        // 2-char message label
    pub block_id: char,       // Block identifier
    pub msg_no: String,       // Message sequence number
    pub flight: String,       // Flight number
    pub text: String,         // Message text
}

/// Decode ACARS frame from raw bytes (after sync + parity strip).
pub fn decode_acars(data: &[u8]) -> Option<AcarsMessage> {
    if data.len() < 13 { return None; }

    let mode = data[0] as char;
    let reg: String = data[1..8].iter().map(|&b| (b & 0x7F) as char).collect();
    let ack = (data[8] & 0x7F) as char;
    let label = String::from_utf8_lossy(&data[9..11]).to_string();
    let block_id = (data[11] & 0x7F) as char;

    let text_start = 12;
    let text_end = data.iter().position(|&b| b == 0x03 || b == 0x17).unwrap_or(data.len());

    let msg_no = if text_end > text_start + 4 {
        String::from_utf8_lossy(&data[text_start..text_start + 4]).to_string()
    } else {
        String::new()
    };

    let flight_start = text_start + 4;
    let flight = if text_end > flight_start + 6 {
        String::from_utf8_lossy(&data[flight_start..flight_start + 6]).trim().to_string()
    } else {
        String::new()
    };

    let text = if text_end > flight_start + 6 {
        String::from_utf8_lossy(&data[flight_start + 6..text_end]).to_string()
    } else {
        String::new()
    };

    Some(AcarsMessage {
        mode,
        reg: reg.trim().to_string(),
        ack,
        label,
        block_id,
        msg_no,
        flight,
        text,
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/acars/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: ACARS frame decoder (registration, flight, text)"
```

---

## Task 7: POCSAG RX decoder (inverse of encoder)

**Files:**
- Create: `crates/mayhem-protocols/src/pocsag/decoder.rs`
- Modify: `crates/mayhem-protocols/src/pocsag/mod.rs`

- [ ] **Step 1: Implement POCSAG decoder**

```rust
//! POCSAG decoder: bitstream → decoded pager messages.
//! Inverse of the encoder from Phase 0 Plan 3.

use super::bch::encode_bch;
use super::codeword::{idle_codeword, sync_codeword};

#[derive(Debug, Clone)]
pub struct DecodedPage {
    pub ric: u32,
    pub function: u8,
    pub content: DecodedContent,
}

#[derive(Debug, Clone)]
pub enum DecodedContent {
    Numeric(String),
    Alphanumeric(String),
    ToneOnly,
}

/// Decode POCSAG bitstream (after FSK demod + clock recovery).
/// Input: raw bits as slice of bool.
pub fn decode_pocsag_bitstream(bits: &[bool]) -> Vec<DecodedPage> {
    let mut pages = Vec::new();
    let mut pos = 0;

    // Find preamble end / first sync
    pos = find_sync(bits, pos);

    while pos + 544 <= bits.len() {
        // Expect sync codeword
        let sync = bits_to_u32(&bits[pos..pos + 32]);
        if sync != sync_codeword() {
            pos += 1;
            pos = find_sync(bits, pos);
            continue;
        }
        pos += 32;

        // Process 16 codewords (8 frames × 2)
        let mut batch_cws = [0u32; 16];
        for i in 0..16 {
            if pos + 32 > bits.len() { break; }
            batch_cws[i] = bits_to_u32(&bits[pos..pos + 32]);
            pos += 32;
        }

        // Find address codewords and extract messages
        let mut frame = 0;
        while frame < 16 {
            let cw = batch_cws[frame];
            if cw == idle_codeword() || cw == sync_codeword() {
                frame += 1;
                continue;
            }

            let flag = cw >> 31;
            if flag == 0 {
                // Address codeword
                let addr_field = (cw >> 13) & 0x3FFFF;
                let func = ((cw >> 11) & 0x03) as u8;
                let frame_pos = frame / 2;
                let ric = (addr_field << 3) | (frame_pos as u32);

                // Collect following message codewords
                let mut msg_bits: Vec<bool> = Vec::new();
                frame += 1;
                while frame < 16 {
                    let mcw = batch_cws[frame];
                    if mcw >> 31 != 1 { break; } // Not a message codeword
                    if mcw == idle_codeword() { break; }
                    let data = (mcw >> 11) & 0xFFFFF;
                    for bit_idx in (0..20).rev() {
                        msg_bits.push((data >> bit_idx) & 1 == 1);
                    }
                    frame += 1;
                }

                let content = if msg_bits.is_empty() {
                    DecodedContent::ToneOnly
                } else {
                    // Try alphanumeric first (7-bit LSB)
                    decode_alpha(&msg_bits)
                };

                pages.push(DecodedPage { ric, function: func, content });
            } else {
                frame += 1;
            }
        }
    }

    pages
}

fn decode_alpha(bits: &[bool]) -> DecodedContent {
    let mut chars = Vec::new();
    for chunk in bits.chunks(7) {
        if chunk.len() < 7 { break; }
        let mut val = 0u8;
        for (i, &b) in chunk.iter().enumerate() {
            if b { val |= 1 << i; } // LSB first
        }
        if val == 0 { break; }
        if val >= 32 && val < 127 {
            chars.push(val as char);
        }
    }
    DecodedContent::Alphanumeric(chars.into_iter().collect())
}

fn find_sync(bits: &[bool], start: usize) -> usize {
    let sync = sync_codeword();
    let mut pos = start;
    while pos + 32 <= bits.len() {
        if bits_to_u32(&bits[pos..pos + 32]) == sync {
            return pos;
        }
        pos += 1;
    }
    bits.len()
}

fn bits_to_u32(bits: &[bool]) -> u32 {
    let mut val = 0u32;
    for (i, &b) in bits.iter().take(32).enumerate() {
        if b { val |= 1 << (31 - i); }
    }
    val
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/pocsag/decoder.rs crates/mayhem-protocols/src/pocsag/mod.rs
git commit -m "mayhem-protocols: POCSAG RX decoder (bitstream to pager messages)"
```

---

## Task 8: IPC types for Phase 2a apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and event types**

```rust
// New AppId variants:
AprsRx,
AisRx,
AcarsRx,
PocsagRx,
AfskRx,

// New event types:
pub struct AprsPacketEvent { pub src: String, pub dst: String, pub payload: String, pub lat: Option<f64>, pub lon: Option<f64> }
pub struct AisShipEvent { pub mmsi: u32, pub name: Option<String>, pub lat: f64, pub lon: f64, pub speed_kt: f64, pub course: f64 }
pub struct AcarsMessageEvent { pub reg: String, pub flight: String, pub label: String, pub text: String }
pub struct PocsagPageEvent { pub ric: u32, pub function: u8, pub message: String }
pub struct AfskBitEvent { pub hex_dump: String, pub decoded_ascii: String }
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 2a app IDs and event types (APRS, AIS, ACARS, POCSAG RX, AFSK)"
```

---

## Task 9: App implementations (APRS, AIS, ACARS, POCSAG RX, AFSK RX)

**Files:**
- Create: `crates/mayhem-apps/src/aprs_rx.rs`
- Create: `crates/mayhem-apps/src/ais_rx.rs`
- Create: `crates/mayhem-apps/src/acars_rx.rs`
- Create: `crates/mayhem-apps/src/pocsag_rx.rs`
- Create: `crates/mayhem-apps/src/afsk_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement all 5 app skeletons**

Each follows the same pattern:
- APRS: FM demod @ 144.390 MHz → AFSK Bell 202 → NRZI decode → HDLC unstuff → AX.25 decode → APRS parse → emit events.
- AIS: Source @ 161.975 MHz → GMSK demod → HDLC → AIS decode → emit events.
- ACARS: AM demod @ VHF → AFSK → ACARS frame → emit events.
- POCSAG RX: FM demod → FSK slicer → POCSAG decode → emit events.
- AFSK RX: FM demod → configurable AFSK demod → hex dump → emit events.

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/aprs_rx.rs crates/mayhem-apps/src/ais_rx.rs crates/mayhem-apps/src/acars_rx.rs crates/mayhem-apps/src/pocsag_rx.rs crates/mayhem-apps/src/afsk_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: Phase 2a app skeletons (APRS, AIS, ACARS, POCSAG RX, AFSK RX)"
```

---

## Task 10: Runner — register Phase 2a apps

**Files:**
- Modify: `src-tauri/src/runner.rs`

- [ ] **Step 1: Add match arms and registrations for 5 new apps**

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/runner.rs
git commit -m "runner: register Phase 2a apps (APRS, AIS, ACARS, POCSAG RX, AFSK)"
```

---

## Task 11: Frontend — APRS RX component

**Files:**
- Create: `frontend/src/apps/aprs-rx/AprsRxApp.tsx`

- [ ] **Step 1: Implement APRS app component**

Packet list table (src, dst, type, position), optional map overlay for position reports.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/aprs-rx/
git commit -m "frontend: APRS RX component (packet list + position display)"
```

---

## Task 12: Frontend — AIS, ACARS, POCSAG RX, AFSK RX components

**Files:**
- Create: `frontend/src/apps/ais-rx/AisRxApp.tsx`
- Create: `frontend/src/apps/acars-rx/AcarsRxApp.tsx`
- Create: `frontend/src/apps/pocsag-rx/PocsagRxApp.tsx`
- Create: `frontend/src/apps/afsk-rx/AfskRxApp.tsx`

- [ ] **Step 1: Implement components**

- AIS: Ship table (MMSI, name, position, speed, course) + map.
- ACARS: Message list (registration, flight, label, text).
- POCSAG RX: Page list (RIC, function, message text).
- AFSK: Raw bitstream hex display + configurable mark/space inputs.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/ais-rx/ frontend/src/apps/acars-rx/ frontend/src/apps/pocsag-rx/ frontend/src/apps/afsk-rx/
git commit -m "frontend: AIS, ACARS, POCSAG RX, and AFSK RX components"
```

---

## Task 13: App switcher + integration tests

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `crates/mayhem-protocols/tests/phase2a_protocols.rs`

- [ ] **Step 1: Add Phase 2a apps to switcher**

- [ ] **Step 2: Write protocol integration tests (AX.25 known packet, AIS known message)**

- [ ] **Step 3: Verify and commit**

```bash
cd frontend && npm run build
cargo test -p mayhem-protocols
git add frontend/src/App.tsx crates/mayhem-protocols/tests/phase2a_protocols.rs
git commit -m "Phase 2a integration: switcher update + protocol tests"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | AFSK demod block | Goertzel-based Bell 202 compiles |
| 2 | FSK slicer block | 2/4-level with clock recovery compiles |
| 3 | AX.25 decoder | HDLC unstuff + CRC + frame parse, CRC test passes |
| 4 | APRS parser | Position/status/message extraction |
| 5 | AIS decoder | Message types 1-5, 18, 24 decode |
| 6 | ACARS decoder | Frame fields extracted |
| 7 | POCSAG RX decoder | Bitstream → pages (inverse of encoder) |
| 8 | IPC types | 5 new AppIds + event types |
| 9 | App skeletons | All 5 compile with correct metadata |
| 10 | Runner registration | Match arms for all 5 |
| 11 | APRS frontend | Packet list renders |
| 12 | Other frontends | AIS/ACARS/POCSAG RX/AFSK render |
| 13 | Switcher + tests | All visible, protocol tests pass |
