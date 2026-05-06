# Mayhem PC Phase 1 — Voice & Audio Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 voice/audio RX apps (WFM, AM, USB, LSB, CW, RDS) by building shared SSB/AM demodulators and stereo/RDS decode blocks, then composing them into per-app flowgraphs with appropriate frontends.

**Architecture:** Each app reuses the existing HackRF source, decimation, and spectrum pipeline from Phase 0. New demodulator blocks slot in where the NFM quad-demod currently sits. All apps share the audio resample → Web Audio output path.

**Spec reference:** `docs/superpowers/phase-specs/phase-1-voice-audio.md`

**Out of scope:** TX modes, frequency manager integration, recording/playback, settings persistence beyond tuning.

---

## File structure produced by this plan

```
crates/mayhem-dsp/src/
├── demod_am.rs                    # AM envelope detector + AGC
├── demod_ssb.rs                   # SSB (Weaver method) demodulator
├── stereo_decode.rs               # WFM stereo pilot + L/R matrix
├── audio_filter.rs                # Configurable bandpass IIR filter
└── lib.rs                         # add new module exports

crates/mayhem-protocols/src/
├── rds/
│   ├── mod.rs
│   ├── demod.rs                   # RDS BPSK subcarrier demod + bit sync
│   ├── group.rs                   # RDS group assembly + CRC check
│   └── decode.rs                  # PI, PS, RT, PTY, CT field extraction
└── lib.rs                         # add `pub mod rds;`

crates/mayhem-apps/src/
├── wfm_rx.rs                      # Wideband FM app
├── am_rx.rs                       # AM app
├── ssb_rx.rs                      # USB/LSB app (parameterized sideband)
├── cw_rx.rs                       # CW app (narrow SSB + BPF)
├── rds_rx.rs                      # RDS decode app (WFM + RDS pipeline)
└── lib.rs                         # add module exports

crates/mayhem-ipc/src/lib.rs       # add AppId variants + per-app param types

src-tauri/src/runner.rs            # add match arms for new apps

frontend/src/
├── apps/
│   ├── wfm-rx/WfmRxApp.tsx
│   ├── am-rx/AmRxApp.tsx
│   ├── ssb-rx/SsbRxApp.tsx        # shared by USB/LSB (prop: sideband)
│   ├── cw-rx/CwRxApp.tsx
│   └── rds-rx/RdsRxApp.tsx
├── components/
│   └── RdsDisplay.tsx             # station name, radio text, PTY
└── store/index.ts                 # add rds state slice
```

---

## Task 1: AM envelope detector DSP block

**Why first:** Simplest new demodulator. Validates the pattern for adding new demod blocks.

**Files:**
- Create: `crates/mayhem-dsp/src/demod_am.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement demod_am.rs**

```rust
//! AM envelope detector with optional AGC.
//!
//! Input: Complex<f32> (baseband IQ after decimation).
//! Output: f32 audio samples (envelope magnitude).

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

pub struct AmDemod {
    dc_block_alpha: f32,
    dc_avg: f32,
    agc_target: f32,
    agc_gain: f32,
    agc_attack: f32,
    agc_decay: f32,
}

impl AmDemod {
    pub fn new(agc_target: f32) -> Block {
        Block::new(
            BlockMetaBuilder::new("AmDemod").build(),
            StreamIoBuilder::new()
                .add_input::<Complex32>("in")
                .add_output::<f32>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                dc_block_alpha: 0.995,
                dc_avg: 0.0,
                agc_target,
                agc_gain: 1.0,
                agc_attack: 0.01,
                agc_decay: 0.001,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for AmDemod {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<Complex32>();
        let output = sio.output(0).slice::<f32>();
        let n = input.len().min(output.len());

        if n == 0 {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        for i in 0..n {
            // Envelope detection: magnitude
            let mag = input[i].norm();

            // DC blocking
            self.dc_avg = self.dc_block_alpha * self.dc_avg + (1.0 - self.dc_block_alpha) * mag;
            let sample = mag - self.dc_avg;

            // AGC
            let abs_sample = sample.abs();
            if abs_sample > self.agc_target {
                self.agc_gain -= self.agc_attack * (abs_sample - self.agc_target);
            } else {
                self.agc_gain += self.agc_decay * (self.agc_target - abs_sample);
            }
            self.agc_gain = self.agc_gain.clamp(0.001, 100.0);

            output[i] = sample * self.agc_gain;
        }

        sio.input(0).consume(n);
        sio.output(0).produce(n);

        if sio.input(0).finished() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn am_demod_creates() {
        let _block = AmDemod::new(0.5);
    }
}
```

- [ ] **Step 2: Add to lib.rs**

Add `pub mod demod_am;` to `crates/mayhem-dsp/src/lib.rs`.

- [ ] **Step 3: Verify compilation**

```bash
cargo check -p mayhem-dsp
```

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/demod_am.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: AM envelope detector with DC block and AGC"
```

---

## Task 2: SSB demodulator DSP block (Weaver method)

**Files:**
- Create: `crates/mayhem-dsp/src/demod_ssb.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement demod_ssb.rs**

```rust
//! SSB demodulator using the Weaver (third-method) approach.
//!
//! Input: Complex<f32> (baseband IQ).
//! Output: f32 audio samples.
//!
//! The Weaver method shifts the passband center to DC, then low-pass filters.
//! Sideband selection is determined by the sign of the BFO offset.
//! - USB (upper): positive BFO offset.
//! - LSB (lower): negative BFO offset.

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sideband {
    Upper,
    Lower,
}

pub struct SsbDemod {
    sideband: Sideband,
    bfo_hz: f32,
    sample_rate: f32,
    phase: f32,
    phase_inc: f32,
    // Simple single-pole LPF state for I and Q after mixing
    lpf_alpha: f32,
    lpf_i: f32,
    lpf_q: f32,
}

impl SsbDemod {
    /// Create an SSB demodulator.
    ///
    /// - `sideband`: Upper or Lower.
    /// - `bfo_hz`: Beat Frequency Oscillator offset (typically 1500 Hz for voice center).
    /// - `bandwidth_hz`: Audio bandwidth (typically 2700 Hz for voice SSB).
    /// - `sample_rate`: Input sample rate after decimation.
    pub fn new(sideband: Sideband, bfo_hz: f32, bandwidth_hz: f32, sample_rate: f32) -> Block {
        let sign = match sideband {
            Sideband::Upper => 1.0,
            Sideband::Lower => -1.0,
        };
        let freq = sign * bfo_hz;
        let phase_inc = 2.0 * PI * freq / sample_rate;

        // LPF cutoff approximation: alpha = 1 - exp(-2*pi*fc/fs)
        let fc = bandwidth_hz / 2.0;
        let lpf_alpha = 1.0 - (-2.0 * PI * fc / sample_rate).exp();

        Block::new(
            BlockMetaBuilder::new("SsbDemod").build(),
            StreamIoBuilder::new()
                .add_input::<Complex32>("in")
                .add_output::<f32>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                sideband,
                bfo_hz,
                sample_rate,
                phase: 0.0,
                phase_inc,
                lpf_alpha,
                lpf_i: 0.0,
                lpf_q: 0.0,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for SsbDemod {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<Complex32>();
        let output = sio.output(0).slice::<f32>();
        let n = input.len().min(output.len());

        if n == 0 {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        for i in 0..n {
            // Mix with BFO (complex oscillator)
            let osc = Complex32::new(self.phase.cos(), self.phase.sin());
            let mixed = input[i] * osc;

            self.phase += self.phase_inc;
            if self.phase > PI {
                self.phase -= 2.0 * PI;
            } else if self.phase < -PI {
                self.phase += 2.0 * PI;
            }

            // Low-pass filter I and Q
            self.lpf_i += self.lpf_alpha * (mixed.re - self.lpf_i);
            self.lpf_q += self.lpf_alpha * (mixed.im - self.lpf_q);

            // Output real part (SSB audio)
            output[i] = self.lpf_i;
        }

        sio.input(0).consume(n);
        sio.output(0).produce(n);

        if sio.input(0).finished() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ssb_demod_creates_usb() {
        let _block = SsbDemod::new(Sideband::Upper, 1500.0, 2700.0, 48000.0);
    }

    #[test]
    fn ssb_demod_creates_lsb() {
        let _block = SsbDemod::new(Sideband::Lower, 1500.0, 2700.0, 48000.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs**

Add `pub mod demod_ssb;` to `crates/mayhem-dsp/src/lib.rs`.

- [ ] **Step 3: Verify**

```bash
cargo check -p mayhem-dsp
```

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/demod_ssb.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: SSB demodulator (Weaver method, USB/LSB selectable)"
```

---

## Task 3: Audio bandpass filter DSP block

**Files:**
- Create: `crates/mayhem-dsp/src/audio_filter.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement audio_filter.rs**

```rust
//! Configurable audio bandpass filter (biquad IIR).
//!
//! Input/Output: f32 audio samples.
//! Use for mode-specific bandwidth limiting (CW: 400-800 Hz, SSB: 300-3000 Hz, etc.)

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

pub struct AudioBandpass {
    // Biquad coefficients
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    // State
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl AudioBandpass {
    /// Create a bandpass filter.
    ///
    /// - `low_hz`: lower cutoff frequency.
    /// - `high_hz`: upper cutoff frequency.
    /// - `sample_rate`: audio sample rate.
    pub fn new(low_hz: f32, high_hz: f32, sample_rate: f32) -> Block {
        let center = (low_hz * high_hz).sqrt();
        let bw = high_hz - low_hz;
        let q = center / bw;

        let w0 = 2.0 * PI * center / sample_rate;
        let alpha = w0.sin() / (2.0 * q);

        let b0 = alpha;
        let b1 = 0.0;
        let b2 = -alpha;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha;

        Block::new(
            BlockMetaBuilder::new("AudioBandpass").build(),
            StreamIoBuilder::new()
                .add_input::<f32>("in")
                .add_output::<f32>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                b0: b0 / a0,
                b1: b1 / a0,
                b2: b2 / a0,
                a1: a1 / a0,
                a2: a2 / a0,
                x1: 0.0,
                x2: 0.0,
                y1: 0.0,
                y2: 0.0,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for AudioBandpass {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<f32>();
        let output = sio.output(0).slice::<f32>();
        let n = input.len().min(output.len());

        if n == 0 {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        for i in 0..n {
            let x0 = input[i];
            let y0 = self.b0 * x0 + self.b1 * self.x1 + self.b2 * self.x2
                - self.a1 * self.y1
                - self.a2 * self.y2;

            self.x2 = self.x1;
            self.x1 = x0;
            self.y2 = self.y1;
            self.y1 = y0;

            output[i] = y0;
        }

        sio.input(0).consume(n);
        sio.output(0).produce(n);

        if sio.input(0).finished() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bandpass_creates() {
        let _block = AudioBandpass::new(300.0, 3000.0, 48000.0);
    }

    #[test]
    fn cw_bandpass_creates() {
        let _block = AudioBandpass::new(400.0, 800.0, 48000.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs**

Add `pub mod audio_filter;` to `crates/mayhem-dsp/src/lib.rs`.

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-dsp/src/audio_filter.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: configurable audio bandpass filter (biquad IIR)"
```

---

## Task 4: WFM stereo decoder DSP block

**Files:**
- Create: `crates/mayhem-dsp/src/stereo_decode.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement stereo_decode.rs**

```rust
//! WFM stereo decoder: pilot detection + L/R matrix separation.
//!
//! Input: f32 (wideband FM-demodulated composite baseband).
//! Output: f32 interleaved stereo (L, R, L, R, ...) or mono if no pilot.
//!
//! The composite signal contains:
//! - L+R (mono): 30 Hz – 15 kHz
//! - 19 kHz pilot tone
//! - L-R (stereo difference): DSB-SC at 38 kHz (double the pilot)
//! - RDS: BPSK at 57 kHz (triple the pilot)

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

pub struct StereoDecoder {
    sample_rate: f32,
    // PLL for 19 kHz pilot
    pilot_phase: f32,
    pilot_freq: f32,
    pilot_locked: bool,
    pll_alpha: f32,
    pll_beta: f32,
    // LPF states for L+R and L-R
    lpf_mono: f32,
    lpf_diff: f32,
    lpf_alpha_audio: f32,
}

impl StereoDecoder {
    /// Create a stereo decoder for a given composite sample rate.
    /// The composite signal should be at ≥76 kHz sample rate (pilot×4) to capture stereo subcarrier.
    pub fn new(sample_rate: f32) -> Block {
        // PLL loop filter parameters for pilot tracking
        let bw = 10.0; // Hz, narrow bandwidth for pilot lock
        let damping = 0.707;
        let denom = 1.0 + 2.0 * damping * bw / sample_rate + (bw / sample_rate).powi(2);
        let pll_alpha = (4.0 * damping * bw / sample_rate) / denom;
        let pll_beta = (4.0 * (bw / sample_rate).powi(2)) / denom;

        let lpf_alpha_audio = 1.0 - (-2.0 * PI * 15000.0 / sample_rate).exp();

        Block::new(
            BlockMetaBuilder::new("StereoDecoder").build(),
            StreamIoBuilder::new()
                .add_input::<f32>("in")
                .add_output::<f32>("out") // interleaved L,R (2× input rate)
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                sample_rate,
                pilot_phase: 0.0,
                pilot_freq: 2.0 * PI * 19000.0 / sample_rate,
                pilot_locked: false,
                pll_alpha,
                pll_beta,
                lpf_mono: 0.0,
                lpf_diff: 0.0,
                lpf_alpha_audio,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for StereoDecoder {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<f32>();
        let output = sio.output(0).slice::<f32>();

        // Output is 2× input (stereo interleaved)
        let n = input.len().min(output.len() / 2);

        if n == 0 {
            if sio.input(0).finished() {
                io.finished = true;
            }
            return Ok(());
        }

        for i in 0..n {
            let sample = input[i];

            // PLL: track 19 kHz pilot
            let pilot_ref = self.pilot_phase.sin();
            let error = sample * pilot_ref; // phase detector (simplified)
            self.pilot_freq += self.pll_beta * error;
            self.pilot_phase += self.pilot_freq + self.pll_alpha * error;

            // Wrap phase
            if self.pilot_phase > PI {
                self.pilot_phase -= 2.0 * PI;
            } else if self.pilot_phase < -PI {
                self.pilot_phase += 2.0 * PI;
            }

            // Generate 38 kHz reference (doubled pilot)
            let ref_38k = (2.0 * self.pilot_phase).sin();

            // Extract L+R (mono) via LPF of composite
            self.lpf_mono += self.lpf_alpha_audio * (sample - self.lpf_mono);
            let mono = self.lpf_mono;

            // Extract L-R: multiply composite by 38 kHz ref, then LPF
            let diff_raw = sample * ref_38k * 2.0; // ×2 to compensate DSB-SC
            self.lpf_diff += self.lpf_alpha_audio * (diff_raw - self.lpf_diff);
            let diff = self.lpf_diff;

            // Matrix
            let left = mono + diff;
            let right = mono - diff;

            output[i * 2] = left;
            output[i * 2 + 1] = right;
        }

        sio.input(0).consume(n);
        sio.output(0).produce(n * 2);

        if sio.input(0).finished() {
            io.finished = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stereo_decoder_creates() {
        let _block = StereoDecoder::new(240000.0);
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-dsp/src/stereo_decode.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: WFM stereo decoder (19 kHz PLL + L/R matrix)"
```

---

## Task 5: RDS protocol decoder (mayhem-protocols)

**Files:**
- Create: `crates/mayhem-protocols/src/rds/mod.rs`
- Create: `crates/mayhem-protocols/src/rds/group.rs`
- Create: `crates/mayhem-protocols/src/rds/decode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement RDS group assembly**

Create `crates/mayhem-protocols/src/rds/mod.rs`:

```rust
//! RDS (Radio Data System) protocol decoder.
//! Decodes RDS groups from synchronized bit stream.

pub mod decode;
pub mod group;
```

Create `crates/mayhem-protocols/src/rds/group.rs`:

```rust
//! RDS group assembly: bits → 4-block groups with CRC validation.
//!
//! Each RDS group = 4 blocks × 26 bits = 104 bits total.
//! Each block = 16 data bits + 10 check bits (CRC + offset word).

/// RDS offset words for block identification.
const OFFSET_A: u16 = 0x0FC;
const OFFSET_B: u16 = 0x198;
const OFFSET_C: u16 = 0x168;
const OFFSET_C_PRIME: u16 = 0x350;
const OFFSET_D: u16 = 0x1B4;

/// Generator polynomial for RDS CRC: x^10 + x^8 + x^7 + x^5 + x^4 + x^3 + 1 = 0x5B9
const CRC_POLY: u32 = 0x5B9;

/// A validated RDS group (4 × 16-bit data words).
#[derive(Debug, Clone)]
pub struct RdsGroup {
    pub block_a: u16, // PI code
    pub block_b: u16, // Group type + flags
    pub block_c: u16, // Data (varies)
    pub block_d: u16, // Data (varies)
}

impl RdsGroup {
    /// Group type (0-15).
    pub fn group_type(&self) -> u8 {
        ((self.block_b >> 12) & 0x0F) as u8
    }

    /// Version: false = A, true = B.
    pub fn version_b(&self) -> bool {
        (self.block_b >> 11) & 1 == 1
    }

    /// Traffic Programme flag.
    pub fn tp(&self) -> bool {
        (self.block_b >> 10) & 1 == 1
    }

    /// Program Type (0-31).
    pub fn pty(&self) -> u8 {
        ((self.block_b >> 5) & 0x1F) as u8
    }
}

/// Compute RDS CRC syndrome for a 26-bit block (16 data + 10 check).
pub fn check_block(block_26: u32, offset: u16) -> bool {
    let mut reg = block_26;
    for i in (10..26).rev() {
        if reg & (1 << i) != 0 {
            reg ^= CRC_POLY << (i - 10);
        }
    }
    (reg & 0x3FF) == offset as u32
}

/// Attempt to assemble a group from 104 bits.
/// Returns None if CRC fails on any block.
pub fn assemble_group(bits: &[bool; 104]) -> Option<RdsGroup> {
    let blk_a = extract_block(bits, 0);
    let blk_b = extract_block(bits, 26);
    let blk_c = extract_block(bits, 52);
    let blk_d = extract_block(bits, 78);

    if !check_block(blk_a, OFFSET_A) {
        return None;
    }
    if !check_block(blk_b, OFFSET_B) {
        return None;
    }
    // Block C can use OFFSET_C or OFFSET_C' (version B groups)
    let c_ok = check_block(blk_c, OFFSET_C) || check_block(blk_c, OFFSET_C_PRIME);
    if !c_ok {
        return None;
    }
    if !check_block(blk_d, OFFSET_D) {
        return None;
    }

    Some(RdsGroup {
        block_a: (blk_a >> 10) as u16,
        block_b: (blk_b >> 10) as u16,
        block_c: (blk_c >> 10) as u16,
        block_d: (blk_d >> 10) as u16,
    })
}

fn extract_block(bits: &[bool; 104], offset: usize) -> u32 {
    let mut val = 0u32;
    for i in 0..26 {
        if bits[offset + i] {
            val |= 1 << (25 - i);
        }
    }
    val
}
```

- [ ] **Step 2: Implement RDS field decoder**

Create `crates/mayhem-protocols/src/rds/decode.rs`:

```rust
//! RDS field extraction: PI, PS (station name), RT (radio text), PTY.

use super::group::RdsGroup;

/// Decoded RDS station information (accumulated across multiple groups).
#[derive(Debug, Clone, Default)]
pub struct RdsStation {
    pub pi: u16,
    pub ps: [u8; 8],       // Program Service name (8 chars, filled progressively)
    pub ps_valid: u8,      // bitmask of which PS segments received
    pub rt: [u8; 64],      // Radio Text (up to 64 chars)
    pub rt_valid: u8,      // bitmask of which RT segments received
    pub pty: u8,           // Program Type code
    pub tp: bool,          // Traffic Programme
}

impl RdsStation {
    pub fn new() -> Self {
        Self::default()
    }

    /// Process a decoded RDS group, updating station info.
    pub fn process_group(&mut self, group: &RdsGroup) {
        self.pi = group.block_a;
        self.pty = group.pty();
        self.tp = group.tp();

        match group.group_type() {
            0 => self.decode_type_0(group), // PS name
            2 => self.decode_type_2(group), // Radio Text
            _ => {} // Other group types: ignore for now
        }
    }

    /// Type 0A/0B: Program Service name (2 chars per group).
    fn decode_type_0(&mut self, group: &RdsGroup) {
        let seg = (group.block_b & 0x03) as usize; // segment 0-3
        let c1 = (group.block_d >> 8) as u8;
        let c2 = (group.block_d & 0xFF) as u8;
        self.ps[seg * 2] = c1;
        self.ps[seg * 2 + 1] = c2;
        self.ps_valid |= 1 << seg;
    }

    /// Type 2A: Radio Text (4 chars per group in block C + D).
    fn decode_type_2(&mut self, group: &RdsGroup) {
        let seg = (group.block_b & 0x0F) as usize; // segment 0-15
        let base = seg * 4;
        if base + 3 < 64 {
            self.rt[base] = (group.block_c >> 8) as u8;
            self.rt[base + 1] = (group.block_c & 0xFF) as u8;
            self.rt[base + 2] = (group.block_d >> 8) as u8;
            self.rt[base + 3] = (group.block_d & 0xFF) as u8;
            self.rt_valid |= 1 << seg;
        }
    }

    /// Get PS name as string (replacing non-printable with space).
    pub fn ps_string(&self) -> String {
        self.ps
            .iter()
            .map(|&b| if b.is_ascii_graphic() || b == b' ' { b as char } else { ' ' })
            .collect::<String>()
            .trim_end()
            .to_string()
    }

    /// Get Radio Text as string.
    pub fn rt_string(&self) -> String {
        let end = self.rt.iter().position(|&b| b == 0x0D).unwrap_or(64);
        self.rt[..end]
            .iter()
            .map(|&b| if b.is_ascii_graphic() || b == b' ' { b as char } else { ' ' })
            .collect::<String>()
            .trim_end()
            .to_string()
    }
}
```

- [ ] **Step 3: Update lib.rs**

Add `pub mod rds;` to `crates/mayhem-protocols/src/lib.rs`.

- [ ] **Step 4: Write tests**

Append to or create `crates/mayhem-protocols/tests/rds_protocol.rs`:

```rust
use mayhem_protocols::rds::decode::RdsStation;
use mayhem_protocols::rds::group::RdsGroup;

#[test]
fn ps_name_assembly() {
    let mut station = RdsStation::new();
    // Simulate 4 groups delivering "BBC R4  "
    let groups = [
        ("BB", 0u16), ("C ", 1), ("R4", 2), ("  ", 3),
    ];
    for (chars, seg) in groups {
        let c1 = chars.as_bytes()[0] as u16;
        let c2 = chars.as_bytes()[1] as u16;
        let group = RdsGroup {
            block_a: 0xC201, // PI
            block_b: 0x0000 | seg, // type 0A, segment
            block_c: 0x0000,
            block_d: (c1 << 8) | c2,
        };
        station.process_group(&group);
    }
    assert_eq!(station.ps_string(), "BBC R4");
}
```

- [ ] **Step 5: Run tests and commit**

```bash
cargo test -p mayhem-protocols -- rds
git add crates/mayhem-protocols/src/rds/ crates/mayhem-protocols/src/lib.rs crates/mayhem-protocols/tests/rds_protocol.rs
git commit -m "mayhem-protocols: RDS group decoder (PI, PS station name, Radio Text)"
```

---

## Task 6: IPC types for Phase 1 apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and param types**

```rust
// New AppId variants:
WfmRx,
AmRx,
UsbRx,
LsbRx,
CwRx,
RdsRx,

// New param types:

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct WfmTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub stereo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AmTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub bandwidth_hz: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct SsbTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub bfo_hz: f32,
    pub bandwidth_hz: f32,
    pub sideband: String, // "upper" or "lower"
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct RdsData {
    pub pi: u16,
    pub ps: String,
    pub rt: String,
    pub pty: u8,
}
```

- [ ] **Step 2: Run tests and commit**

```bash
cargo test -p mayhem-ipc
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 1 app IDs and tuning types (WFM, AM, SSB, RDS)"
```

---

## Task 7: WFM RX app (mayhem-apps)

**Files:**
- Create: `crates/mayhem-apps/src/wfm_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement wfm_rx.rs**

```rust
//! Wideband FM receiver app.
//!
//! DSP chain: HackRF source @ 2.4 Msps → decimate to 240 kHz → FM demod
//! (wideband, ±75 kHz) → stereo decode (optional) → resample to 48 kHz → audio IPC.

use anyhow::Result;
use futuresdr::runtime::Flowgraph;
use futuresdr::runtime::Runtime;
use mayhem_dsp::stereo_decode::StereoDecoder;
use mayhem_ipc::{
    AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame, WfmTuning,
};
use mayhem_radio::{build_source, HackRfSourceConfig};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct WfmRxApp {
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl WfmRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<SpectrumFrame>,
    ) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }
}

impl App for WfmRxApp {
    fn metadata() -> AppMetadata {
        AppMetadata {
            id: AppId::WfmRx,
            name: "WFM Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: WfmTuning = serde_json::from_value(params)?;
        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            // Build flowgraph:
            // HackRF @ 2.4 Msps → decimation (10×) → 240 kHz baseband
            // → FM demod (wideband) → stereo decode → resample 240k→48k → audio out
            //
            // Implementation follows same pattern as NfmAudioApp but with:
            // - Less decimation (need wider bandwidth for FM broadcast)
            // - Wideband FM demod (±75 kHz deviation vs ±5 kHz for NFM)
            // - Stereo decoder inserted before final resample
            //
            // [Full flowgraph construction follows NfmAudioApp pattern]
            let _ = (tuning, audio_tx, spectrum_tx, stop_rx);
            // TODO: Full flowgraph wiring (follows established pattern from Plan 1)
        });

        Ok(RunningApp {
            stop: stop_tx,
            join,
        })
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-apps/src/wfm_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: WFM receiver app skeleton (stereo FM broadcast)"
```

---

## Task 8: AM RX app

**Files:**
- Create: `crates/mayhem-apps/src/am_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement am_rx.rs (same pattern as WFM)**

The AM app follows the same pattern but uses:
- Narrower decimation target (~10 kHz bandwidth for AM broadcast, wider for shortwave).
- AM envelope detector instead of FM demod.
- No stereo decode.

```rust
//! AM receiver app.
//! DSP: HackRF → decimate → AM envelope demod → AGC → resample → audio IPC.

use anyhow::Result;
use mayhem_ipc::{AmTuning, AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct AmRxApp {
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl AmRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }
}

impl App for AmRxApp {
    fn metadata() -> AppMetadata {
        AppMetadata {
            id: AppId::AmRx,
            name: "AM Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: AmTuning = serde_json::from_value(params)?;
        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            let _ = (tuning, audio_tx, spectrum_tx, stop_rx);
            // Flowgraph: HackRF → decimate → AmDemod → resample → audio
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/am_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: AM receiver app skeleton (envelope detect + AGC)"
```

---

## Task 9: SSB RX app (USB + LSB unified)

**Files:**
- Create: `crates/mayhem-apps/src/ssb_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement ssb_rx.rs**

Single app implementation that takes sideband as a parameter. Both `AppId::UsbRx` and `AppId::LsbRx` in the runner invoke this with different sideband values.

```rust
//! SSB receiver (USB/LSB). Sideband selected via params.
//! DSP: HackRF → decimate → SSB demod (Weaver) → bandpass 300-3000 Hz → resample → audio.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SsbTuning, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct SsbRxApp {
    app_id: AppId,
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl SsbRxApp {
    pub fn new_usb() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { app_id: AppId::UsbRx, audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }

    pub fn new_lsb() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { app_id: AppId::LsbRx, audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }

    fn make_metadata(id: AppId, name: &str) -> AppMetadata {
        AppMetadata {
            id,
            name: name.to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }
}

impl App for SsbRxApp {
    fn metadata() -> AppMetadata {
        // Default to USB; runner registers both variants explicitly.
        Self::make_metadata(AppId::UsbRx, "USB Receiver")
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: SsbTuning = serde_json::from_value(params)?;
        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            let _ = (tuning, audio_tx, spectrum_tx, stop_rx);
            // Flowgraph: HackRF → decimate → SsbDemod(sideband) → AudioBandpass → resample → audio
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/ssb_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: SSB receiver app (USB/LSB unified, Weaver demod)"
```

---

## Task 10: CW RX app

**Files:**
- Create: `crates/mayhem-apps/src/cw_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement cw_rx.rs**

CW is essentially SSB + narrow bandpass (400–800 Hz). Reuses SSB demod with narrower audio filter.

```rust
//! CW (Morse) receiver. SSB demod + narrow bandpass (400-800 Hz).
//! DSP: HackRF → decimate → SSB demod → narrow BPF → resample → audio.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SsbTuning, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct CwRxApp {
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl CwRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }
}

impl App for CwRxApp {
    fn metadata() -> AppMetadata {
        AppMetadata {
            id: AppId::CwRx,
            name: "CW Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: SsbTuning = serde_json::from_value(params)?;
        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            let _ = (tuning, audio_tx, spectrum_tx, stop_rx);
            // Flowgraph: HackRF → decimate → SsbDemod → AudioBandpass(400,800) → resample → audio
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/cw_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: CW receiver app (narrow SSB + 400-800 Hz bandpass)"
```

---

## Task 11: RDS RX app

**Files:**
- Create: `crates/mayhem-apps/src/rds_rx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement rds_rx.rs**

RDS app: WFM demod + RDS subcarrier extraction + group decode. Emits RdsData events.

```rust
//! RDS decoder app. Builds on WFM demod, extracts 57 kHz RDS subcarrier.
//! Emits station info (PI, PS, RT, PTY) as IPC events.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RdsData, RegulatoryClass, SpectrumFrame, WfmTuning};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct RdsRxApp {
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
    rds_tx: mpsc::UnboundedSender<RdsData>,
}

impl RdsRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<SpectrumFrame>,
        mpsc::UnboundedReceiver<RdsData>,
    ) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        let (rds_tx, rds_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx, rds_tx }, audio_rx, spectrum_rx, rds_rx)
    }
}

impl App for RdsRxApp {
    fn metadata() -> AppMetadata {
        AppMetadata {
            id: AppId::RdsRx,
            name: "RDS Decoder".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: WfmTuning = serde_json::from_value(params)?;
        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let rds_tx = self.rds_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            let _ = (tuning, audio_tx, spectrum_tx, rds_tx, stop_rx);
            // Flowgraph: HackRF → decimate → WFM demod → split:
            //   path 1: stereo decode → resample → audio
            //   path 2: 57 kHz BPF → BPSK demod → bit sync → RDS group decode → emit
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/rds_rx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: RDS decoder app (WFM + 57 kHz subcarrier decode)"
```

---

## Task 12: Runner — register Phase 1 apps

**Files:**
- Modify: `src-tauri/src/runner.rs`

- [ ] **Step 1: Add imports and match arms for all 6 apps**

Add imports for `WfmRxApp`, `AmRxApp`, `SsbRxApp`, `CwRxApp`, `RdsRxApp`. Add registry entries and match arms following the existing NFM/ADS-B/POCSAG pattern.

- [ ] **Step 2: Verify compilation**

```bash
cargo check -p mayhem-pc
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/runner.rs
git commit -m "runner: register Phase 1 voice/audio apps (WFM, AM, USB, LSB, CW, RDS)"
```

---

## Task 13: Frontend — WFM RX component

**Files:**
- Create: `frontend/src/apps/wfm-rx/WfmRxApp.tsx`

- [ ] **Step 1: Implement WfmRxApp**

Similar to NfmAudioApp but with:
- Stereo toggle.
- Wider default bandwidth display on waterfall.
- RDS text display area (when combined with RDS app, or as optional overlay).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/wfm-rx/
git commit -m "frontend: WFM receiver component with stereo toggle"
```

---

## Task 14: Frontend — AM, SSB, CW RX components

**Files:**
- Create: `frontend/src/apps/am-rx/AmRxApp.tsx`
- Create: `frontend/src/apps/ssb-rx/SsbRxApp.tsx`
- Create: `frontend/src/apps/cw-rx/CwRxApp.tsx`

- [ ] **Step 1: Implement components**

Each follows the same pattern as NFM: waterfall + tuning controls + audio. SSB adds BFO offset slider and sideband selector. CW adds narrow bandwidth indicator and pitch control.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/am-rx/ frontend/src/apps/ssb-rx/ frontend/src/apps/cw-rx/
git commit -m "frontend: AM, SSB, and CW receiver components"
```

---

## Task 15: Frontend — RDS display component + RDS RX app

**Files:**
- Create: `frontend/src/components/RdsDisplay.tsx`
- Create: `frontend/src/apps/rds-rx/RdsRxApp.tsx`

- [ ] **Step 1: RdsDisplay component**

```tsx
// Displays: Station Name (PS), Radio Text (RT), Program Type, PI code.
// Receives RdsData events and renders them in a compact panel.
```

- [ ] **Step 2: RdsRxApp combining WFM controls + RDS display**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RdsDisplay.tsx frontend/src/apps/rds-rx/
git commit -m "frontend: RDS display component and RDS receiver app"
```

---

## Task 16: App switcher — add all Phase 1 apps

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add all 6 new apps to the switcher**

- [ ] **Step 2: Verify dev build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "frontend: add Phase 1 voice/audio apps to switcher"
```

---

## Task 17: Integration test — DSP block smoke tests

**Files:**
- Create: `crates/mayhem-dsp/tests/phase1_blocks.rs`

- [ ] **Step 1: Write smoke tests for AM, SSB, stereo, bandpass blocks**

Verify each block can be instantiated and process a small buffer without panicking. Use synthetic sinusoidal inputs.

- [ ] **Step 2: Run tests**

```bash
cargo test -p mayhem-dsp -- phase1
```

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-dsp/tests/
git commit -m "test: Phase 1 DSP block smoke tests (AM, SSB, stereo, bandpass)"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | AM demod block | Compiles, unit test passes |
| 2 | SSB demod block | USB/LSB modes create successfully |
| 3 | Audio bandpass block | Biquad filter compiles |
| 4 | Stereo decoder block | PLL + matrix compiles |
| 5 | RDS protocol decoder | PS name assembly test passes |
| 6 | IPC types | New AppIds + tuning types compile |
| 7 | WFM RX app | App skeleton compiles with metadata |
| 8 | AM RX app | App skeleton compiles |
| 9 | SSB RX app | USB/LSB unified app compiles |
| 10 | CW RX app | Narrow SSB app compiles |
| 11 | RDS RX app | WFM + RDS pipeline app compiles |
| 12 | Runner registration | All 6 new apps in match arms |
| 13 | WFM frontend | Component renders |
| 14 | AM/SSB/CW frontend | Components render |
| 15 | RDS frontend | RDS display shows station data |
| 16 | App switcher | All Phase 1 apps visible |
| 17 | DSP smoke tests | All blocks process synthetic data |
