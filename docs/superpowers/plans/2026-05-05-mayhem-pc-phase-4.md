# Mayhem PC Phase 4 — Specialty Receivers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 specialty receiver apps: NOAA APT RX, DSC RX, EPIRB RX, Radiosonde RX (extended), DAB RX (lite), NOAA HRPT RX, Meteor M2 LRPT RX, and ADS-B Extended. Each is largely standalone with its own DSP pipeline.

**Architecture:** Each app requires unique signal processing. Shared infrastructure is minimal — reuse HackRF source, spectrum display, and map components from earlier phases. New blocks are per-app.

**Spec reference:** `docs/superpowers/phase-specs/phase-4-specialty-rx.md`

---

## File structure produced by this plan

```
crates/mayhem-dsp/src/
├── apt_decode.rs                  # NOAA APT line sync + pixel extraction
├── bpsk_demod.rs                  # Generic BPSK demodulator (carrier recovery + timing)
├── ofdm_sync.rs                   # OFDM time/freq sync (for DAB)
└── lib.rs

crates/mayhem-protocols/src/
├── apt/
│   ├── mod.rs
│   └── image.rs                   # APT image assembly (channel A/B, sync detection)
├── dsc/
│   ├── mod.rs
│   └── decode.rs                  # DSC ITU-R M.493 message decoder
├── epirb/
│   ├── mod.rs
│   └── decode.rs                  # COSPAS-SARSAT 406 MHz beacon decoder
├── dab/
│   ├── mod.rs
│   └── fic.rs                     # DAB FIC (Fast Information Channel) decoder
├── sonde/ (extend)
│   ├── m10.rs                     # Full M10 implementation
│   └── dfm.rs                     # Full DFM implementation
└── lib.rs

crates/mayhem-apps/src/
├── apt_rx.rs
├── dsc_rx.rs
├── epirb_rx.rs
├── sonde_rx_ext.rs                # Extended sonde (adds M10, DFM, iMet)
├── dab_rx.rs
├── hrpt_rx.rs
├── lrpt_rx.rs
├── adsb_rx_ext.rs                 # Extended ADS-B (DF4/5/11/20/21)
└── lib.rs

crates/mayhem-ipc/src/lib.rs      # new AppIds + event types

frontend/src/apps/
├── apt-rx/AptRxApp.tsx            # Progressive image display
├── dsc-rx/DscRxApp.tsx            # Message table
├── epirb-rx/EpirbRxApp.tsx        # Beacon table
├── sonde-rx/SondeRxExtApp.tsx     # Extended telemetry + map
├── dab-rx/DabRxApp.tsx            # Ensemble/service list
├── hrpt-rx/HrptRxApp.tsx          # Multi-channel image
├── lrpt-rx/LrptRxApp.tsx          # Progressive image
└── adsb-ext/AdsbExtApp.tsx        # Enhanced aircraft table
```

---

## Task 1: BPSK demodulator DSP block

**Why first:** Used by EPIRB RX and HRPT RX. Generic carrier recovery + symbol timing for BPSK signals.

**Files:**
- Create: `crates/mayhem-dsp/src/bpsk_demod.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement bpsk_demod.rs**

```rust
//! Generic BPSK demodulator with carrier recovery and symbol timing.
//!
//! Input: Complex<f32> (baseband IQ, after decimation to near-symbol-rate).
//! Output: u8 hard decision bits (0 or 1).
//!
//! Uses Costas loop for carrier recovery and Mueller-Muller for timing.

use futuresdr::anyhow::Result;
use futuresdr::num_complex::Complex32;
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

pub struct BpskDemod {
    symbol_rate: f32,
    sample_rate: f32,
    samples_per_symbol: f32,
    // Costas loop state
    costas_phase: f32,
    costas_freq: f32,
    costas_alpha: f32,
    costas_beta: f32,
    // Mueller-Muller timing recovery
    mu: f32,
    gain_mu: f32,
    last_sample: Complex32,
    last_decision: f32,
    sample_counter: f32,
}

impl BpskDemod {
    pub fn new(symbol_rate: f32, sample_rate: f32) -> Block {
        let samples_per_symbol = sample_rate / symbol_rate;
        // Costas loop bandwidth (~symbol_rate / 100)
        let loop_bw = symbol_rate * 0.01 / sample_rate * 2.0 * PI;
        let damping = 0.707;
        let denom = 1.0 + 2.0 * damping * loop_bw + loop_bw * loop_bw;
        let costas_alpha = 4.0 * damping * loop_bw / denom;
        let costas_beta = 4.0 * loop_bw * loop_bw / denom;

        Block::new(
            BlockMetaBuilder::new("BpskDemod").build(),
            StreamIoBuilder::new()
                .add_input::<Complex32>("in")
                .add_output::<u8>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                symbol_rate,
                sample_rate,
                samples_per_symbol,
                costas_phase: 0.0,
                costas_freq: 0.0,
                costas_alpha,
                costas_beta,
                mu: 0.0,
                gain_mu: 0.05 / samples_per_symbol,
                last_sample: Complex32::new(0.0, 0.0),
                last_decision: 0.0,
                sample_counter: 0.0,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for BpskDemod {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<Complex32>();
        let output = sio.output(0).slice::<u8>();

        if input.is_empty() {
            if sio.input(0).finished() { io.finished = true; }
            return Ok(());
        }

        let mut in_idx = 0;
        let mut out_idx = 0;

        while in_idx < input.len() && out_idx < output.len() {
            // Carrier recovery: rotate input by Costas phase
            let osc = Complex32::new(self.costas_phase.cos(), -self.costas_phase.sin());
            let sample = input[in_idx] * osc;
            in_idx += 1;

            // Costas loop error (BPSK): sign(Re) * Im
            let error = sample.re.signum() * sample.im;
            self.costas_freq += self.costas_beta * error;
            self.costas_phase += self.costas_freq + self.costas_alpha * error;
            if self.costas_phase > PI { self.costas_phase -= 2.0 * PI; }
            if self.costas_phase < -PI { self.costas_phase += 2.0 * PI; }

            // Symbol timing (simplified: sample at symbol rate)
            self.sample_counter += 1.0;
            if self.sample_counter >= self.samples_per_symbol + self.mu {
                // Decision point
                let decision = if sample.re >= 0.0 { 1u8 } else { 0u8 };
                output[out_idx] = decision;
                out_idx += 1;

                // Mueller-Muller timing error
                let current_decision = if sample.re >= 0.0 { 1.0f32 } else { -1.0 };
                let timing_error = (current_decision - self.last_decision) * self.last_sample.re
                    - (current_decision - self.last_decision) * sample.re;
                self.mu += self.gain_mu * timing_error;
                self.mu = self.mu.clamp(-0.5, 0.5);

                self.last_decision = current_decision;
                self.sample_counter = 0.0;
            }
            self.last_sample = sample;
        }

        sio.input(0).consume(in_idx);
        sio.output(0).produce(out_idx);
        if sio.input(0).finished() && in_idx == input.len() { io.finished = true; }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bpsk_demod_creates() {
        let _block = BpskDemod::new(400.0, 48000.0);
    }

    #[test]
    fn bpsk_demod_ais_rate() {
        let _block = BpskDemod::new(9600.0, 48000.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-dsp/src/bpsk_demod.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: BPSK demodulator (Costas loop + Mueller-Muller timing)"
```

---

## Task 2: NOAA APT image decoder (mayhem-protocols)

**Files:**
- Create: `crates/mayhem-protocols/src/apt/mod.rs`
- Create: `crates/mayhem-protocols/src/apt/image.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement APT line sync and image assembly**

```rust
//! NOAA APT (Automatic Picture Transmission) image decoder.
//!
//! APT format: 2 lines per frame (channel A + channel B), each 2080 pixels wide.
//! Line rate: 2 lines/second (4160 samples/s at 4160 sps, or 2 pixels per audio sample at ~4160 Hz).
//! Sync: 7-pulse sync A (channel A) and 7-pulse sync B (channel B) markers.

pub mod image;
pub use image::{AptDecoder, AptLine, AptChannel};
```

```rust
// image.rs
//! APT image assembly from demodulated audio samples.

/// APT line (one complete scan line = 2080 pixels).
#[derive(Debug, Clone)]
pub struct AptLine {
    pub line_number: u32,
    pub channel: AptChannel,
    pub pixels: Vec<u8>, // 0-255 luminance, 2080 pixels wide
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AptChannel {
    A, // Visible (daytime) or IR (nighttime)
    B, // IR (daytime) or thermal (nighttime)
}

/// Sync pattern for channel A: 7 pulses of specific width.
const SYNC_A_PATTERN: [u8; 40] = [
    0, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0,
    255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0,
    255, 255, 0, 0, 255, 255, 0, 0,
];

/// APT decoder state machine.
pub struct AptDecoder {
    samples_per_line: usize, // 2080 at native APT rate
    current_line: Vec<u8>,
    line_number: u32,
    sync_locked: bool,
    sample_count: usize,
}

impl AptDecoder {
    /// Create decoder for a given audio sample rate.
    /// APT has 4160 "pixels" per second (2 lines × 2080 pixels).
    /// If audio is at 11025 Hz, we get ~5.3 audio samples per pixel.
    pub fn new(audio_sample_rate: f32) -> Self {
        let samples_per_pixel = audio_sample_rate / 4160.0;
        let samples_per_line = (samples_per_pixel * 2080.0).round() as usize;
        Self {
            samples_per_line,
            current_line: Vec::with_capacity(2080),
            line_number: 0,
            sync_locked: false,
            sample_count: 0,
        }
    }

    /// Feed audio samples (normalized 0.0-1.0) and get completed lines.
    pub fn process(&mut self, samples: &[f32]) -> Vec<AptLine> {
        let mut lines = Vec::new();
        let samples_per_pixel = self.samples_per_line as f32 / 2080.0;

        for &sample in samples {
            self.sample_count += 1;

            // Downsample to pixel rate
            if self.sample_count as f32 >= samples_per_pixel * (self.current_line.len() + 1) as f32 {
                // Convert sample to pixel (0-255)
                let pixel = (sample.clamp(0.0, 1.0) * 255.0) as u8;
                self.current_line.push(pixel);

                if self.current_line.len() >= 2080 {
                    // Line complete
                    let channel = if self.line_number % 2 == 0 {
                        AptChannel::A
                    } else {
                        AptChannel::B
                    };

                    lines.push(AptLine {
                        line_number: self.line_number,
                        channel,
                        pixels: self.current_line.clone(),
                    });

                    self.current_line.clear();
                    self.line_number += 1;
                    self.sample_count = 0;
                }
            }
        }

        lines
    }

    /// Attempt sync detection using correlation with known sync pattern.
    pub fn detect_sync(samples: &[f32], threshold: f32) -> Option<usize> {
        if samples.len() < 40 { return None; }

        let pattern: Vec<f32> = SYNC_A_PATTERN.iter().map(|&b| b as f32 / 255.0).collect();
        let mut best_corr = 0.0f32;
        let mut best_pos = 0;

        for i in 0..samples.len().saturating_sub(40) {
            let mut corr = 0.0f32;
            for j in 0..40 {
                corr += samples[i + j] * pattern[j];
            }
            if corr > best_corr {
                best_corr = corr;
                best_pos = i;
            }
        }

        if best_corr > threshold { Some(best_pos) } else { None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decoder_creates() {
        let decoder = AptDecoder::new(11025.0);
        assert!(decoder.samples_per_line > 0);
    }

    #[test]
    fn process_generates_lines() {
        let mut decoder = AptDecoder::new(11025.0);
        // Feed enough samples for at least one line
        let samples = vec![0.5f32; decoder.samples_per_line + 100];
        let lines = decoder.process(&samples);
        assert!(!lines.is_empty());
        assert_eq!(lines[0].pixels.len(), 2080);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/apt/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: NOAA APT image decoder (line sync + pixel assembly)"
```

---

## Task 3: DSC protocol decoder

**Files:**
- Create: `crates/mayhem-protocols/src/dsc/mod.rs`
- Create: `crates/mayhem-protocols/src/dsc/decode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement DSC decoder**

```rust
//! DSC (Digital Selective Calling) decoder — ITU-R M.493.
//! 100 baud FSK on maritime frequencies.

#[derive(Debug, Clone)]
pub struct DscMessage {
    pub format: DscFormat,
    pub mmsi: u32,           // 9-digit MMSI
    pub category: DscCategory,
    pub nature: Option<DistressNature>,
    pub position: Option<(f64, f64)>, // lat, lon
    pub time: Option<(u8, u8)>,       // hours, minutes UTC
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DscFormat {
    Distress,
    AllShips,
    GroupCall,
    AreaCall,
    Individual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DscCategory {
    Routine,
    Safety,
    Urgency,
    Distress,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DistressNature {
    Fire,
    Flooding,
    Collision,
    Grounding,
    Capsizing,
    Sinking,
    Adrift,
    Undesignated,
    Abandoning,
    Piracy,
    ManOverboard,
    Epirb,
}

/// Decode DSC message from 10-bit symbols (after FSK demod + symbol sync).
/// DSC uses 10-bit symbols: 7 data + 3 error detection.
pub fn decode_dsc(symbols: &[u16]) -> Option<DscMessage> {
    if symbols.len() < 20 { return None; }

    // Strip error bits, extract 7-bit values
    let chars: Vec<u8> = symbols.iter().map(|&s| (s & 0x7F) as u8).collect();

    // Find format specifier
    let format = match chars.first()? {
        112 => DscFormat::Distress,
        116 => DscFormat::AllShips,
        114 => DscFormat::GroupCall,
        102 => DscFormat::AreaCall,
        120 => DscFormat::Individual,
        _ => return None,
    };

    // Extract MMSI (next 10 symbols, each encoding one BCD digit)
    let mmsi = if chars.len() > 11 {
        let mut m = 0u32;
        for i in 1..10 {
            m = m * 10 + (chars[i] as u32 & 0x0F);
        }
        m
    } else {
        0
    };

    let category = match format {
        DscFormat::Distress => DscCategory::Distress,
        _ => {
            if chars.len() > 12 {
                match chars[11] {
                    100 => DscCategory::Routine,
                    108 => DscCategory::Safety,
                    110 => DscCategory::Urgency,
                    112 => DscCategory::Distress,
                    _ => DscCategory::Routine,
                }
            } else {
                DscCategory::Routine
            }
        }
    };

    Some(DscMessage {
        format,
        mmsi,
        category,
        nature: None,  // Full decode deferred
        position: None,
        time: None,
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/dsc/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: DSC maritime protocol decoder (ITU-R M.493)"
```

---

## Task 4: EPIRB beacon decoder

**Files:**
- Create: `crates/mayhem-protocols/src/epirb/mod.rs`
- Create: `crates/mayhem-protocols/src/epirb/decode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement EPIRB COSPAS-SARSAT decoder**

```rust
//! EPIRB (Emergency Position Indicating Radio Beacon) decoder.
//! 406 MHz COSPAS-SARSAT protocol. BPSK @ 400 bps.
//! 144-bit message after frame sync.

#[derive(Debug, Clone)]
pub struct EpirbBeacon {
    pub hex_id: String,       // 15-hex-char beacon ID
    pub country_code: u16,    // MID (Maritime Identification Digits)
    pub protocol: EpirbProtocol,
    pub position: Option<(f64, f64)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EpirbProtocol {
    Maritime,
    Aviation,
    Serial,
    Test,
    Unknown,
}

/// Decode EPIRB message from 144 bits (after frame sync removal).
pub fn decode_epirb(bits: &[bool]) -> Option<EpirbBeacon> {
    if bits.len() < 112 { return None; } // Minimum for first PDF

    // PDF-1 (Protected Data Field 1): bits 25-85 (61 bits)
    // Contains: protocol flag, country code, beacon ID type, ID

    let protocol_flag = bits[25];
    let country_code = extract_uint(bits, 27, 10) as u16;

    let protocol = if !protocol_flag {
        // Short protocol
        match extract_uint(bits, 37, 3) as u8 {
            1 => EpirbProtocol::Maritime,
            2 => EpirbProtocol::Aviation,
            3 => EpirbProtocol::Serial,
            7 => EpirbProtocol::Test,
            _ => EpirbProtocol::Unknown,
        }
    } else {
        // Long protocol (user protocol)
        EpirbProtocol::Serial
    };

    // Extract hex ID (full 60-bit ID field as hex string)
    let mut hex_id = String::new();
    for i in (25..85).step_by(4) {
        let nibble = extract_uint(bits, i, 4.min(85 - i)) as u8;
        hex_id.push(std::char::from_digit(nibble as u32, 16).unwrap_or('0'));
    }

    // PDF-2 position (if present, bits 107-132)
    let position = if bits.len() >= 133 {
        let lat_raw = extract_int(bits, 107, 13);
        let lon_raw = extract_int(bits, 120, 14);
        let lat = lat_raw as f64 / 60.0; // approximate
        let lon = lon_raw as f64 / 60.0;
        if lat.abs() <= 90.0 && lon.abs() <= 180.0 {
            Some((lat, lon))
        } else {
            None
        }
    } else {
        None
    };

    Some(EpirbBeacon {
        hex_id,
        country_code,
        protocol,
        position,
    })
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
    if val & (1 << (len - 1)) != 0 {
        val as i64 | (!0i64 << len)
    } else {
        val as i64
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/epirb/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: EPIRB COSPAS-SARSAT 406 MHz beacon decoder"
```

---

## Task 5: DAB FIC decoder (lite)

**Files:**
- Create: `crates/mayhem-protocols/src/dab/mod.rs`
- Create: `crates/mayhem-protocols/src/dab/fic.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement DAB FIC decoder (ensemble/service labels)**

```rust
//! DAB (Digital Audio Broadcasting) FIC decoder.
//! Decodes FIG (Fast Information Group) types 0, 1 to extract:
//! - Ensemble label
//! - Service labels and IDs
//! - Program type

#[derive(Debug, Clone)]
pub struct DabEnsemble {
    pub eid: u16,              // Ensemble ID
    pub label: String,         // Ensemble label (up to 16 chars)
    pub services: Vec<DabService>,
}

#[derive(Debug, Clone)]
pub struct DabService {
    pub sid: u32,              // Service ID
    pub label: String,         // Service label (station name)
    pub pty: u8,               // Program type
}

/// Decode FIC data (after OFDM demod + Viterbi + energy dispersal).
/// Input: FIC blocks (each 256 bits = 32 bytes).
pub fn decode_fic(fic_blocks: &[&[u8]]) -> DabEnsemble {
    let mut ensemble = DabEnsemble {
        eid: 0,
        label: String::new(),
        services: Vec::new(),
    };

    for block in fic_blocks {
        if block.len() < 3 { continue; }
        decode_fib(block, &mut ensemble);
    }

    ensemble
}

fn decode_fib(fib: &[u8], ensemble: &mut DabEnsemble) {
    let mut offset = 0;
    while offset + 1 < fib.len() {
        let fig_type = (fib[offset] >> 5) & 0x07;
        let fig_len = (fib[offset] & 0x1F) as usize;
        offset += 1;

        if offset + fig_len > fib.len() { break; }
        let fig_data = &fib[offset..offset + fig_len];

        match fig_type {
            0 => decode_fig0(fig_data, ensemble),
            1 => decode_fig1(fig_data, ensemble),
            7 => break, // End marker
            _ => {}
        }

        offset += fig_len;
    }
}

fn decode_fig0(data: &[u8], ensemble: &mut DabEnsemble) {
    if data.is_empty() { return; }
    let extension = data[0] & 0x1F;
    match extension {
        0 => {
            // FIG 0/0: Ensemble information
            if data.len() >= 5 {
                ensemble.eid = u16::from_be_bytes([data[1], data[2]]);
            }
        }
        2 => {
            // FIG 0/2: Service organization (basic service definition)
            // Contains service IDs
            let mut i = 1;
            while i + 3 < data.len() {
                let sid = u16::from_be_bytes([data[i], data[i + 1]]) as u32;
                if !ensemble.services.iter().any(|s| s.sid == sid) {
                    ensemble.services.push(DabService {
                        sid,
                        label: String::new(),
                        pty: 0,
                    });
                }
                i += 4; // simplified stride
            }
        }
        17 => {
            // FIG 0/17: Program type
            let mut i = 1;
            while i + 3 < data.len() {
                let sid = u16::from_be_bytes([data[i], data[i + 1]]) as u32;
                let pty = data[i + 3] & 0x1F;
                if let Some(svc) = ensemble.services.iter_mut().find(|s| s.sid == sid) {
                    svc.pty = pty;
                }
                i += 4;
            }
        }
        _ => {}
    }
}

fn decode_fig1(data: &[u8], ensemble: &mut DabEnsemble) {
    if data.len() < 3 { return; }
    let charset = (data[0] >> 4) & 0x0F;
    let extension = data[0] & 0x07;

    match extension {
        0 => {
            // FIG 1/0: Ensemble label
            if data.len() >= 19 {
                // EID (2 bytes) + label (16 bytes) + char flag (2 bytes)
                let label_bytes = &data[3..19];
                ensemble.label = String::from_utf8_lossy(label_bytes).trim().to_string();
            }
        }
        1 => {
            // FIG 1/1: Service label
            if data.len() >= 21 {
                let sid = u16::from_be_bytes([data[1], data[2]]) as u32;
                let label_bytes = &data[3..19];
                let label = String::from_utf8_lossy(label_bytes).trim().to_string();
                if let Some(svc) = ensemble.services.iter_mut().find(|s| s.sid == sid) {
                    svc.label = label;
                } else {
                    ensemble.services.push(DabService { sid, label, pty: 0 });
                }
            }
        }
        _ => {}
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/dab/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: DAB FIC decoder (ensemble + service labels)"
```

---

## Task 6: IPC types for Phase 4 apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and event types**

```rust
// AppIds:
AptRx, DscRx, EpirbRx, SondeRxExt, DabRx, HrptRx, LrptRx, AdsbRxExt,

// Event types:
pub struct AptLineEvent { pub line_number: u32, pub channel: String, pub pixels: Vec<u8> }
pub struct DscMessageEvent { pub mmsi: u32, pub format: String, pub category: String }
pub struct EpirbBeaconEvent { pub hex_id: String, pub country_code: u16, pub lat: Option<f64>, pub lon: Option<f64> }
pub struct DabServiceEvent { pub eid: u16, pub ensemble_label: String, pub services: Vec<DabServiceInfo> }
pub struct DabServiceInfo { pub sid: u32, pub label: String, pub pty: u8 }
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 4 app IDs and event types (APT, DSC, EPIRB, DAB, sonde ext)"
```

---

## Task 7: App implementations (all 8 Phase 4 apps)

**Files:**
- Create: `crates/mayhem-apps/src/apt_rx.rs`
- Create: `crates/mayhem-apps/src/dsc_rx.rs`
- Create: `crates/mayhem-apps/src/epirb_rx.rs`
- Create: `crates/mayhem-apps/src/sonde_rx_ext.rs`
- Create: `crates/mayhem-apps/src/dab_rx.rs`
- Create: `crates/mayhem-apps/src/hrpt_rx.rs`
- Create: `crates/mayhem-apps/src/lrpt_rx.rs`
- Create: `crates/mayhem-apps/src/adsb_rx_ext.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement app skeletons**

- APT RX: Source @ 137 MHz → WFM demod → AM subcarrier → APT line decode → emit lines.
- DSC RX: Source @ 156.525 MHz → FM demod → FSK 100 baud → DSC frame decode → emit.
- EPIRB RX: Source @ 406 MHz → BPSK demod 400 bps → frame sync → BCH → emit.
- Sonde RX Ext: Source @ 403 MHz → FM → FSK → RS41/M10/DFM auto-detect → emit telemetry.
- DAB RX: Source @ Band III → OFDM sync → DQPSK → FIC decode → emit ensemble info.
- HRPT RX: Source @ 1698 MHz → BPSK → CADU frame sync → channel extract → emit image.
- LRPT RX: Source @ 137 MHz → QPSK → Viterbi → RS → image → emit.
- ADS-B Ext: Extend existing ADS-B with DF4/5/11/20/21 decode → enhanced aircraft data.

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/apt_rx.rs crates/mayhem-apps/src/dsc_rx.rs crates/mayhem-apps/src/epirb_rx.rs crates/mayhem-apps/src/sonde_rx_ext.rs crates/mayhem-apps/src/dab_rx.rs crates/mayhem-apps/src/hrpt_rx.rs crates/mayhem-apps/src/lrpt_rx.rs crates/mayhem-apps/src/adsb_rx_ext.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: Phase 4 specialty receiver skeletons (8 apps)"
```

---

## Task 8: Runner registration

**Files:**
- Modify: `src-tauri/src/runner.rs`

- [ ] **Step 1: Register all 8 apps**

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/runner.rs
git commit -m "runner: register Phase 4 specialty receivers (8 apps)"
```

---

## Task 9: Frontend — APT image display component

**Files:**
- Create: `frontend/src/apps/apt-rx/AptRxApp.tsx`

- [ ] **Step 1: Implement progressive image display**

Canvas-based component that appends lines as they're received. Two-panel display (channel A + channel B). Gray-scale image with adjustable contrast.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/apt-rx/
git commit -m "frontend: NOAA APT receiver with progressive image display"
```

---

## Task 10: Frontend — remaining Phase 4 components

**Files:**
- Create: `frontend/src/apps/dsc-rx/DscRxApp.tsx`
- Create: `frontend/src/apps/epirb-rx/EpirbRxApp.tsx`
- Create: `frontend/src/apps/sonde-rx/SondeRxExtApp.tsx`
- Create: `frontend/src/apps/dab-rx/DabRxApp.tsx`
- Create: `frontend/src/apps/hrpt-rx/HrptRxApp.tsx`
- Create: `frontend/src/apps/lrpt-rx/LrptRxApp.tsx`
- Create: `frontend/src/apps/adsb-ext/AdsbExtApp.tsx`

- [ ] **Step 1: Implement components**

- DSC: Message table (MMSI, format, category, position, time).
- EPIRB: Beacon alert table (hex ID, country, position, protocol).
- Sonde Ext: Telemetry panel + map track + altitude graph.
- DAB: Ensemble list → service list → program type.
- HRPT: Multi-channel satellite image viewer.
- LRPT: Progressive 3-channel image.
- ADS-B Ext: Enhanced aircraft table with BDS register data.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/dsc-rx/ frontend/src/apps/epirb-rx/ frontend/src/apps/sonde-rx/ frontend/src/apps/dab-rx/ frontend/src/apps/hrpt-rx/ frontend/src/apps/lrpt-rx/ frontend/src/apps/adsb-ext/
git commit -m "frontend: Phase 4 specialty receiver components (7 apps)"
```

---

## Task 11: App switcher + build verification

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add all 8 Phase 4 apps to switcher**

- [ ] **Step 2: Verify builds**

```bash
cd frontend && npm run build
cargo check -p mayhem-pc
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "frontend: add Phase 4 specialty receivers to app switcher"
```

---

## Task 12: Protocol integration tests

**Files:**
- Create: `crates/mayhem-protocols/tests/phase4_protocols.rs`

- [ ] **Step 1: Write tests**

- APT: process synthetic samples, verify line output dimensions.
- DSC: decode known symbol sequence.
- EPIRB: decode known 144-bit beacon message.
- DAB: decode known FIB sequence, verify ensemble/service extraction.

- [ ] **Step 2: Commit**

```bash
cargo test -p mayhem-protocols -- phase4
git add crates/mayhem-protocols/tests/phase4_protocols.rs
git commit -m "test: Phase 4 protocol integration tests (APT, DSC, EPIRB, DAB)"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | BPSK demod block | Costas + timing recovery compiles |
| 2 | APT image decoder | Line assembly from samples, test passes |
| 3 | DSC decoder | Maritime message fields extracted |
| 4 | EPIRB decoder | Beacon hex ID + country + protocol |
| 5 | DAB FIC decoder | Ensemble + service labels extracted |
| 6 | IPC types | 8 AppIds + event types |
| 7 | App skeletons | All 8 compile |
| 8 | Runner | All 8 registered |
| 9 | APT frontend | Progressive image canvas |
| 10 | Other frontends | 7 components render |
| 11 | Switcher | All visible, builds pass |
| 12 | Tests | Protocol decode tests pass |
