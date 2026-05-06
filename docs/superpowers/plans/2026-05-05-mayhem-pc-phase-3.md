# Mayhem PC Phase 3 — OOK / Sub-GHz Capture & Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 sub-GHz capture and analysis apps: TPMS RX, OOK Analyzer, Scanner, Recon, Looking Glass, Signal Generator, OOK Protocol Decoders, and Sub-GHz Capture. These share a common OOK envelope detection + pulse analysis pipeline and a wideband scanner engine.

**Architecture:** New DSP blocks for OOK envelope detection and pulse timing analysis. New scanner engine (rapid retune + FFT). Signal Generator reuses HackRF sink from Phase 0. Protocol matching is data-driven (TOML definitions).

**Spec reference:** `docs/superpowers/phase-specs/phase-3-ook-subghz.md`

---

## File structure produced by this plan

```
crates/mayhem-dsp/src/
├── ook_envelope.rs                # OOK envelope detector + adaptive threshold
├── pulse_analyze.rs               # Pulse timing measurement + classification
├── scanner_engine.rs              # Wideband frequency scanner (retune + FFT)
├── sig_gen.rs                     # Signal generator waveforms (CW, sweep, noise)
└── lib.rs

crates/mayhem-protocols/src/
├── ook/
│   ├── mod.rs
│   ├── protocols.rs               # Known OOK protocol database + matcher
│   └── tpms.rs                    # TPMS-specific decoders (Schrader, etc.)
└── lib.rs

crates/mayhem-apps/src/
├── tpms_rx.rs
├── ook_analyzer.rs
├── scanner.rs
├── recon.rs
├── looking_glass.rs
├── sig_gen.rs
├── ook_decoders.rs
├── subghz_capture.rs
└── lib.rs

crates/mayhem-ipc/src/lib.rs      # new AppIds + event types

frontend/src/apps/
├── tpms-rx/TpmsRxApp.tsx
├── ook-analyzer/OokAnalyzerApp.tsx
├── scanner/ScannerApp.tsx
├── recon/ReconApp.tsx
├── looking-glass/LookingGlassApp.tsx
├── sig-gen/SigGenApp.tsx
├── ook-decoders/OokDecodersApp.tsx
└── subghz-capture/SubGhzCaptureApp.tsx
```

---

## Task 1: OOK envelope detector DSP block

**Why first:** Every app in this phase needs to extract pulse trains from raw IQ.

**Files:**
- Create: `crates/mayhem-dsp/src/ook_envelope.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement ook_envelope.rs**

```rust
//! OOK envelope detector with adaptive threshold.
//!
//! Input: Complex<f32> IQ samples.
//! Output: u8 (0 = low/space, 1 = high/mark) — binary pulse train.
//!
//! Pipeline: magnitude → moving-average smoothing → adaptive threshold → binary output.

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

pub struct OokEnvelope {
    /// Smoothing window size (samples)
    smooth_len: usize,
    /// Ring buffer for moving average
    smooth_buf: Vec<f32>,
    smooth_idx: usize,
    smooth_sum: f32,
    /// Adaptive threshold: factor above noise floor
    threshold_factor: f32,
    /// Slow-tracking noise floor estimate
    noise_floor: f32,
    noise_alpha: f32, // IIR coefficient for noise tracking
}

impl OokEnvelope {
    /// Create an OOK envelope detector.
    ///
    /// - `smooth_window`: moving-average window in samples (e.g., 10).
    /// - `threshold_factor`: signal must be this many times above noise (e.g., 3.0).
    /// - `noise_alpha`: IIR tracking speed for noise floor (e.g., 0.001).
    pub fn new(smooth_window: usize, threshold_factor: f32, noise_alpha: f32) -> Block {
        Block::new(
            BlockMetaBuilder::new("OokEnvelope").build(),
            StreamIoBuilder::new()
                .add_input::<Complex32>("in")
                .add_output::<u8>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                smooth_len: smooth_window,
                smooth_buf: vec![0.0; smooth_window],
                smooth_idx: 0,
                smooth_sum: 0.0,
                threshold_factor,
                noise_floor: 0.001,
                noise_alpha,
            },
        )
    }

    /// Default configuration suitable for 433 MHz OOK signals at 250 ksps.
    pub fn default_433() -> Block {
        Self::new(8, 3.0, 0.0005)
    }
}

#[async_trait::async_trait]
impl Kernel for OokEnvelope {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<Complex32>();
        let output = sio.output(0).slice::<u8>();
        let n = input.len().min(output.len());

        if n == 0 {
            if sio.input(0).finished() { io.finished = true; }
            return Ok(());
        }

        for i in 0..n {
            let mag = input[i].norm();

            // Moving average smoothing
            self.smooth_sum -= self.smooth_buf[self.smooth_idx];
            self.smooth_buf[self.smooth_idx] = mag;
            self.smooth_sum += mag;
            self.smooth_idx = (self.smooth_idx + 1) % self.smooth_len;
            let smoothed = self.smooth_sum / self.smooth_len as f32;

            // Adaptive threshold: track noise floor during "low" periods
            let threshold = self.noise_floor * self.threshold_factor;
            if smoothed < threshold {
                // Update noise floor (only when signal is below threshold)
                self.noise_floor += self.noise_alpha * (smoothed - self.noise_floor);
            }

            output[i] = if smoothed > threshold { 1 } else { 0 };
        }

        sio.input(0).consume(n);
        sio.output(0).produce(n);
        if sio.input(0).finished() { io.finished = true; }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ook_envelope_creates() {
        let _block = OokEnvelope::default_433();
    }

    #[test]
    fn custom_config() {
        let _block = OokEnvelope::new(16, 5.0, 0.001);
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-dsp/src/ook_envelope.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: OOK envelope detector with adaptive threshold"
```

---

## Task 2: Pulse analyzer DSP block

**Files:**
- Create: `crates/mayhem-dsp/src/pulse_analyze.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement pulse_analyze.rs**

```rust
//! Pulse timing analyzer.
//!
//! Input: u8 binary stream (0/1 from OOK envelope detector).
//! Output: PulseEvent stream (pulse/gap durations with timestamps).
//!
//! Also provides offline analysis: classify encoding type, estimate symbol rate.

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

/// A single pulse or gap event.
#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct PulseEvent {
    /// true = pulse (high), false = gap (low)
    pub is_pulse: u8,
    /// Duration in samples
    pub duration: u32,
    /// Sample offset from start
    pub offset: u64,
}

pub struct PulseAnalyzer {
    last_level: u8,
    run_length: u32,
    global_offset: u64,
    min_pulse_samples: u32, // ignore glitches shorter than this
}

impl PulseAnalyzer {
    /// Create a pulse analyzer.
    ///
    /// - `min_pulse_samples`: minimum pulse/gap duration to emit (filters glitches).
    pub fn new(min_pulse_samples: u32) -> Block {
        Block::new(
            BlockMetaBuilder::new("PulseAnalyzer").build(),
            StreamIoBuilder::new()
                .add_input::<u8>("in")
                .add_output::<PulseEvent>("out")
                .build(),
            MessageIoBuilder::new().build(),
            Self {
                last_level: 0,
                run_length: 0,
                global_offset: 0,
                min_pulse_samples,
            },
        )
    }
}

#[async_trait::async_trait]
impl Kernel for PulseAnalyzer {
    async fn work(
        &mut self,
        io: &mut WorkIo,
        sio: &mut StreamIo,
        _mio: &mut MessageIo<Self>,
        _meta: &mut BlockMeta,
    ) -> Result<()> {
        let input = sio.input(0).slice::<u8>();
        let output = sio.output(0).slice::<PulseEvent>();

        if input.is_empty() {
            if sio.input(0).finished() { io.finished = true; }
            return Ok(());
        }

        let mut in_idx = 0;
        let mut out_idx = 0;

        while in_idx < input.len() && out_idx < output.len() {
            let level = input[in_idx];
            in_idx += 1;

            if level == self.last_level {
                self.run_length += 1;
            } else {
                // Transition — emit previous run if long enough
                if self.run_length >= self.min_pulse_samples {
                    output[out_idx] = PulseEvent {
                        is_pulse: self.last_level,
                        duration: self.run_length,
                        offset: self.global_offset - self.run_length as u64,
                    };
                    out_idx += 1;
                }
                self.last_level = level;
                self.run_length = 1;
            }
            self.global_offset += 1;
        }

        sio.input(0).consume(in_idx);
        sio.output(0).produce(out_idx);
        if sio.input(0).finished() && in_idx == input.len() { io.finished = true; }
        Ok(())
    }
}

/// Offline pulse analysis: given a list of pulse events, classify the encoding.
#[derive(Debug, Clone)]
pub struct PulseAnalysis {
    pub encoding: PulseEncoding,
    pub estimated_symbol_rate: f32,
    pub short_pulse_us: f32,
    pub long_pulse_us: f32,
    pub sync_pulse_us: Option<f32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PulseEncoding {
    PulseDistance,   // Fixed pulse width, variable gap
    PulseWidth,     // Variable pulse width, fixed gap
    Manchester,     // Equal pulse/gap, transition encodes bit
    Raw,            // Unclassified
}

/// Analyze a sequence of pulse events and classify the encoding.
pub fn classify_pulses(events: &[PulseEvent], sample_rate: f32) -> PulseAnalysis {
    if events.is_empty() {
        return PulseAnalysis {
            encoding: PulseEncoding::Raw,
            estimated_symbol_rate: 0.0,
            short_pulse_us: 0.0,
            long_pulse_us: 0.0,
            sync_pulse_us: None,
        };
    }

    let pulse_durations: Vec<f32> = events
        .iter()
        .filter(|e| e.is_pulse != 0)
        .map(|e| e.duration as f32 / sample_rate * 1_000_000.0) // to microseconds
        .collect();

    let gap_durations: Vec<f32> = events
        .iter()
        .filter(|e| e.is_pulse == 0)
        .map(|e| e.duration as f32 / sample_rate * 1_000_000.0)
        .collect();

    if pulse_durations.is_empty() {
        return PulseAnalysis {
            encoding: PulseEncoding::Raw,
            estimated_symbol_rate: 0.0,
            short_pulse_us: 0.0,
            long_pulse_us: 0.0,
            sync_pulse_us: None,
        };
    }

    // Find clusters in pulse durations
    let (short_p, long_p) = find_two_clusters(&pulse_durations);
    let (short_g, long_g) = find_two_clusters(&gap_durations);

    // Classification heuristic
    let pulse_ratio = if short_p > 0.0 { long_p / short_p } else { 1.0 };
    let gap_ratio = if short_g > 0.0 { long_g / short_g } else { 1.0 };

    let encoding = if pulse_ratio < 1.5 && gap_ratio > 1.8 {
        PulseEncoding::PulseDistance
    } else if pulse_ratio > 1.8 && gap_ratio < 1.5 {
        PulseEncoding::PulseWidth
    } else if pulse_ratio < 1.5 && gap_ratio < 1.5 {
        PulseEncoding::Manchester
    } else {
        PulseEncoding::Raw
    };

    // Find sync pulse (unusually long gap or pulse)
    let max_gap = gap_durations.iter().cloned().fold(0.0f32, f32::max);
    let mean_gap = gap_durations.iter().sum::<f32>() / gap_durations.len() as f32;
    let sync_pulse_us = if max_gap > mean_gap * 3.0 { Some(max_gap) } else { None };

    let symbol_period_us = short_p + short_g;
    let estimated_symbol_rate = if symbol_period_us > 0.0 {
        1_000_000.0 / symbol_period_us
    } else {
        0.0
    };

    PulseAnalysis {
        encoding,
        estimated_symbol_rate,
        short_pulse_us: short_p,
        long_pulse_us: long_p,
        sync_pulse_us,
    }
}

fn find_two_clusters(values: &[f32]) -> (f32, f32) {
    if values.is_empty() { return (0.0, 0.0); }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Simple k=2 clustering: find the biggest gap between consecutive sorted values
    let mut max_gap = 0.0f32;
    let mut split_idx = sorted.len() / 2;
    for i in 1..sorted.len() {
        let gap = sorted[i] - sorted[i - 1];
        if gap > max_gap {
            max_gap = gap;
            split_idx = i;
        }
    }

    let short = sorted[..split_idx].iter().sum::<f32>() / split_idx.max(1) as f32;
    let long = sorted[split_idx..].iter().sum::<f32>() / (sorted.len() - split_idx).max(1) as f32;
    (short, long)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pulse_analyzer_creates() {
        let _block = PulseAnalyzer::new(5);
    }

    #[test]
    fn classify_empty() {
        let result = classify_pulses(&[], 1_000_000.0);
        assert_eq!(result.encoding, PulseEncoding::Raw);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-dsp/src/pulse_analyze.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: pulse timing analyzer with encoding classification"
```

---

## Task 3: Scanner engine DSP block

**Files:**
- Create: `crates/mayhem-dsp/src/scanner_engine.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement scanner_engine.rs**

```rust
//! Wideband frequency scanner engine.
//!
//! Not a FutureSDR block — this is a standalone async engine that controls the
//! HackRF source directly, rapidly retuning and measuring power at each step.
//!
//! Used by: Scanner, Recon, Looking Glass apps.

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub start_hz: f64,
    pub stop_hz: f64,
    pub step_hz: f64,
    pub dwell_ms: u32,
    pub sample_rate: f64,   // capture sample rate per step
    pub fft_size: usize,
    pub squelch_db: f32,    // only report signals above this level
}

impl ScanConfig {
    pub fn num_steps(&self) -> usize {
        ((self.stop_hz - self.start_hz) / self.step_hz).ceil() as usize + 1
    }

    pub fn validate(&self) -> Result<()> {
        if self.start_hz >= self.stop_hz {
            anyhow::bail!("start_hz must be less than stop_hz");
        }
        if self.step_hz <= 0.0 {
            anyhow::bail!("step_hz must be positive");
        }
        if self.dwell_ms == 0 {
            anyhow::bail!("dwell_ms must be > 0");
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub freq_hz: f64,
    pub power_db: f32,
    pub peak_freq_hz: f64, // refined peak within this step's bandwidth
}

/// Compute power spectrum from IQ samples (simple periodogram).
/// Returns power in dB for each FFT bin.
pub fn compute_power_spectrum(samples: &[futuresdr::num_complex::Complex32], fft_size: usize) -> Vec<f32> {
    use std::f32::consts::PI;

    let n = samples.len().min(fft_size);
    let mut power = vec![0.0f32; fft_size];

    // Simple DFT for small sizes, or use FFT crate for larger
    // For scanner use, fft_size is typically small (256-1024)
    for k in 0..fft_size {
        let mut re = 0.0f32;
        let mut im = 0.0f32;
        for (i, s) in samples.iter().take(n).enumerate() {
            let angle = -2.0 * PI * k as f32 * i as f32 / fft_size as f32;
            re += s.re * angle.cos() - s.im * angle.sin();
            im += s.re * angle.sin() + s.im * angle.cos();
        }
        let mag_sq = re * re + im * im;
        power[k] = 10.0 * (mag_sq / n as f32).max(1e-12).log10();
    }

    power
}

/// Find peak power and its frequency offset within a power spectrum.
pub fn find_peak(power_db: &[f32], center_hz: f64, sample_rate: f64) -> ScanResult {
    let fft_size = power_db.len();
    let mut max_power = f32::NEG_INFINITY;
    let mut max_bin = 0;

    for (i, &p) in power_db.iter().enumerate() {
        if p > max_power {
            max_power = p;
            max_bin = i;
        }
    }

    // Convert bin to frequency offset
    let bin_offset = if max_bin >= fft_size / 2 {
        max_bin as f64 - fft_size as f64
    } else {
        max_bin as f64
    };
    let freq_offset = bin_offset * sample_rate / fft_size as f64;

    ScanResult {
        freq_hz: center_hz,
        power_db: max_power,
        peak_freq_hz: center_hz + freq_offset,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_config_validates() {
        let cfg = ScanConfig {
            start_hz: 400e6,
            stop_hz: 500e6,
            step_hz: 1e6,
            dwell_ms: 10,
            sample_rate: 2.4e6,
            fft_size: 256,
            squelch_db: -50.0,
        };
        assert!(cfg.validate().is_ok());
        assert_eq!(cfg.num_steps(), 101);
    }

    #[test]
    fn invalid_config_rejected() {
        let cfg = ScanConfig {
            start_hz: 500e6,
            stop_hz: 400e6,
            step_hz: 1e6,
            dwell_ms: 10,
            sample_rate: 2.4e6,
            fft_size: 256,
            squelch_db: -50.0,
        };
        assert!(cfg.validate().is_err());
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-dsp/src/scanner_engine.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: wideband scanner engine (retune + FFT power measurement)"
```

---

## Task 4: Signal generator waveforms

**Files:**
- Create: `crates/mayhem-dsp/src/sig_gen.rs`
- Modify: `crates/mayhem-dsp/src/lib.rs`

- [ ] **Step 1: Implement sig_gen.rs**

```rust
//! Signal generator: produces IQ sample buffers for various waveforms.
//! Used by the Signal Generator app to feed the HackRF sink.

use futuresdr::num_complex::Complex32;
use std::f32::consts::PI;

#[derive(Debug, Clone)]
pub enum Waveform {
    /// Single CW tone at offset_hz from center.
    Cw { offset_hz: f32 },
    /// Two tones (for IMD testing).
    TwoTone { offset1_hz: f32, offset2_hz: f32 },
    /// Linear frequency sweep.
    Sweep { start_hz: f32, stop_hz: f32, sweep_time_s: f32 },
    /// White noise (uniform random phase, flat spectrum).
    Noise,
    /// PRBS (pseudo-random binary sequence) — useful for BER testing.
    Prbs { bit_rate: f32 },
}

/// Generate a buffer of IQ samples for the given waveform.
///
/// - `waveform`: waveform type and parameters.
/// - `sample_rate`: output sample rate.
/// - `num_samples`: number of samples to generate.
/// - `phase`: starting phase (updated in place for continuity across buffers).
pub fn generate_samples(
    waveform: &Waveform,
    sample_rate: f32,
    num_samples: usize,
    phase: &mut f32,
) -> Vec<Complex32> {
    match waveform {
        Waveform::Cw { offset_hz } => {
            let phase_inc = 2.0 * PI * offset_hz / sample_rate;
            let mut out = Vec::with_capacity(num_samples);
            for _ in 0..num_samples {
                out.push(Complex32::new(phase.cos(), phase.sin()));
                *phase += phase_inc;
                if *phase > PI { *phase -= 2.0 * PI; }
            }
            out
        }
        Waveform::TwoTone { offset1_hz, offset2_hz } => {
            let inc1 = 2.0 * PI * offset1_hz / sample_rate;
            let inc2 = 2.0 * PI * offset2_hz / sample_rate;
            let mut phase2 = *phase;
            let mut out = Vec::with_capacity(num_samples);
            for _ in 0..num_samples {
                let s1 = Complex32::new(phase.cos(), phase.sin());
                let s2 = Complex32::new(phase2.cos(), phase2.sin());
                out.push((s1 + s2) * 0.5); // normalize
                *phase += inc1;
                phase2 += inc2;
                if *phase > PI { *phase -= 2.0 * PI; }
                if phase2 > PI { phase2 -= 2.0 * PI; }
            }
            out
        }
        Waveform::Sweep { start_hz, stop_hz, sweep_time_s } => {
            let sweep_samples = (sweep_time_s * sample_rate) as usize;
            let mut out = Vec::with_capacity(num_samples);
            for i in 0..num_samples {
                let t = (i % sweep_samples) as f32 / sweep_samples as f32;
                let freq = start_hz + (stop_hz - start_hz) * t;
                let phase_inc = 2.0 * PI * freq / sample_rate;
                out.push(Complex32::new(phase.cos(), phase.sin()));
                *phase += phase_inc;
                if *phase > PI { *phase -= 2.0 * PI; }
            }
            out
        }
        Waveform::Noise => {
            // Simple noise: random phase, uniform magnitude
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut out = Vec::with_capacity(num_samples);
            let mut seed = (*phase * 1000.0) as u64;
            for _ in 0..num_samples {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                let angle = (seed as f32 / u64::MAX as f32) * 2.0 * PI;
                out.push(Complex32::new(angle.cos(), angle.sin()) * 0.7);
            }
            *phase += num_samples as f32; // advance state
            out
        }
        Waveform::Prbs { bit_rate } => {
            let samples_per_bit = (sample_rate / bit_rate) as usize;
            let mut out = Vec::with_capacity(num_samples);
            let mut lfsr: u16 = 0xACE1; // 16-bit LFSR
            let mut bit_count = 0;
            let mut current_val = 1.0f32;
            for _ in 0..num_samples {
                if bit_count == 0 {
                    // LFSR step (taps at 16, 14, 13, 11)
                    let bit = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
                    lfsr = (lfsr >> 1) | ((bit as u16) << 15);
                    current_val = if bit == 1 { 1.0 } else { -1.0 };
                    bit_count = samples_per_bit;
                }
                out.push(Complex32::new(current_val, 0.0));
                bit_count -= 1;
            }
            out
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cw_generates_correct_length() {
        let mut phase = 0.0;
        let samples = generate_samples(&Waveform::Cw { offset_hz: 1000.0 }, 48000.0, 100, &mut phase);
        assert_eq!(samples.len(), 100);
    }

    #[test]
    fn noise_generates() {
        let mut phase = 0.0;
        let samples = generate_samples(&Waveform::Noise, 48000.0, 1000, &mut phase);
        assert_eq!(samples.len(), 1000);
    }

    #[test]
    fn sweep_generates() {
        let mut phase = 0.0;
        let samples = generate_samples(
            &Waveform::Sweep { start_hz: -10000.0, stop_hz: 10000.0, sweep_time_s: 1.0 },
            2400000.0, 2400, &mut phase
        );
        assert_eq!(samples.len(), 2400);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-dsp/src/sig_gen.rs crates/mayhem-dsp/src/lib.rs
git commit -m "mayhem-dsp: signal generator waveforms (CW, two-tone, sweep, noise, PRBS)"
```

---

## Task 5: OOK protocol database + TPMS decoder

**Files:**
- Create: `crates/mayhem-protocols/src/ook/mod.rs`
- Create: `crates/mayhem-protocols/src/ook/protocols.rs`
- Create: `crates/mayhem-protocols/src/ook/tpms.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement OOK protocol matcher and TPMS decoder**

The protocol matcher holds timing definitions for known protocols (PT2262, EV1527, etc.) and attempts to match pulse sequences. TPMS decodes specific tire pressure formats.

- [ ] **Step 2: Write tests for TPMS known vectors**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-protocols/src/ook/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: OOK protocol database + TPMS decoders (Schrader, Sensata)"
```

---

## Task 6: IPC types for Phase 3 apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and event types**

```rust
// New AppId variants:
TpmsRx, OokAnalyzer, Scanner, Recon, LookingGlass, SigGen, OokDecoders, SubGhzCapture,

// New event/param types:
pub struct ScanResultEvent { pub freq_hz: f64, pub power_db: f32 }
pub struct PulseEventIpc { pub is_pulse: bool, pub duration_us: f32 }
pub struct OokDecodeEvent { pub protocol: String, pub code_hex: String, pub bits: u32 }
pub struct TpmsSensorEvent { pub sensor_id: u32, pub pressure_kpa: f32, pub temp_c: f32 }
pub struct SigGenParams { pub waveform: String, pub frequency_hz: f64, pub params: serde_json::Value }
pub struct LookingGlassFrame { pub start_hz: f64, pub step_hz: f64, pub powers_db: Vec<f32> }
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 3 app IDs and event types (scanner, OOK, TPMS, sig gen)"
```

---

## Task 7: App implementations (all 8 Phase 3 apps)

**Files:**
- Create: `crates/mayhem-apps/src/tpms_rx.rs`
- Create: `crates/mayhem-apps/src/ook_analyzer.rs`
- Create: `crates/mayhem-apps/src/scanner.rs`
- Create: `crates/mayhem-apps/src/recon.rs`
- Create: `crates/mayhem-apps/src/looking_glass.rs`
- Create: `crates/mayhem-apps/src/sig_gen_app.rs`
- Create: `crates/mayhem-apps/src/ook_decoders.rs`
- Create: `crates/mayhem-apps/src/subghz_capture.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement app skeletons**

- TPMS: Source @ 315/433 MHz → OOK envelope → pulse analyze → TPMS protocol decode → emit.
- OOK Analyzer: Source → OOK envelope → pulse analyze → emit pulse events + classification.
- Scanner: Scanner engine loop → emit ScanResult events per step.
- Recon: Scanner engine + signal characterization → emit enhanced results.
- Looking Glass: Fast full-band sweep → emit LookingGlassFrame.
- Signal Generator: Generate waveform → HackRF sink. RegulatoryClass::IndoorTestOnly.
- OOK Decoders: Source → OOK envelope → pulse analyze → protocol match → emit decoded.
- Sub-GHz Capture: Source → triggered record → save to file → emit capture event.

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/tpms_rx.rs crates/mayhem-apps/src/ook_analyzer.rs crates/mayhem-apps/src/scanner.rs crates/mayhem-apps/src/recon.rs crates/mayhem-apps/src/looking_glass.rs crates/mayhem-apps/src/sig_gen_app.rs crates/mayhem-apps/src/ook_decoders.rs crates/mayhem-apps/src/subghz_capture.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: Phase 3 app skeletons (TPMS, OOK, scanner, recon, sig gen, capture)"
```

---

## Task 8: Runner registration

**Files:**
- Modify: `src-tauri/src/runner.rs`

- [ ] **Step 1: Register all 8 Phase 3 apps with match arms**

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/runner.rs
git commit -m "runner: register Phase 3 apps (8 OOK/sub-GHz/scanner apps)"
```

---

## Task 9: Frontend — Scanner and Looking Glass components

**Files:**
- Create: `frontend/src/apps/scanner/ScannerApp.tsx`
- Create: `frontend/src/apps/looking-glass/LookingGlassApp.tsx`

- [ ] **Step 1: Scanner component**

Frequency range inputs, scan speed, signal bars (or table), hold/resume, squelch threshold.

- [ ] **Step 2: Looking Glass component**

Full-band waterfall/spectrum display. Zoom and pan. Click-to-tune (opens appropriate RX app).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/apps/scanner/ frontend/src/apps/looking-glass/
git commit -m "frontend: Scanner and Looking Glass components"
```

---

## Task 10: Frontend — OOK, TPMS, Signal Gen, Capture components

**Files:**
- Create: `frontend/src/apps/tpms-rx/TpmsRxApp.tsx`
- Create: `frontend/src/apps/ook-analyzer/OokAnalyzerApp.tsx`
- Create: `frontend/src/apps/sig-gen/SigGenApp.tsx`
- Create: `frontend/src/apps/ook-decoders/OokDecodersApp.tsx`
- Create: `frontend/src/apps/subghz-capture/SubGhzCaptureApp.tsx`
- Create: `frontend/src/apps/recon/ReconApp.tsx`

- [ ] **Step 1: Implement components**

- TPMS: Sensor table (ID, pressure, temperature, signal).
- OOK Analyzer: Pulse timeline visualization, timing histogram, encoding classification display.
- Sig Gen: Waveform selector, frequency/offset inputs, sweep params, arm/disarm (IndoorTestOnly).
- OOK Decoders: Protocol selector, decoded device list, raw pulse view.
- Sub-GHz Capture: Triggered capture control, capture list with metadata, export button.
- Recon: Enhanced scanner table with modulation type + bandwidth columns.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/tpms-rx/ frontend/src/apps/ook-analyzer/ frontend/src/apps/sig-gen/ frontend/src/apps/ook-decoders/ frontend/src/apps/subghz-capture/ frontend/src/apps/recon/
git commit -m "frontend: TPMS, OOK analyzer, sig gen, OOK decoders, capture, recon components"
```

---

## Task 11: App switcher + build verification

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add all 8 Phase 3 apps to switcher**

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
cargo check -p mayhem-pc
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "frontend: add Phase 3 apps to switcher (8 OOK/sub-GHz apps)"
```

---

## Task 12: Integration tests

**Files:**
- Create: `crates/mayhem-dsp/tests/phase3_blocks.rs`
- Create: `crates/mayhem-protocols/tests/ook_protocols.rs`

- [ ] **Step 1: DSP smoke tests (OOK envelope, pulse analyzer, scanner engine, sig gen)**

- [ ] **Step 2: Protocol tests (OOK pattern matching, TPMS known vectors)**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-dsp/tests/phase3_blocks.rs crates/mayhem-protocols/tests/ook_protocols.rs
git commit -m "test: Phase 3 DSP + protocol integration tests"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | OOK envelope detector | Adaptive threshold, compiles |
| 2 | Pulse analyzer | Timing + classification, compiles |
| 3 | Scanner engine | Config validation, FFT power measurement |
| 4 | Signal generator | CW/sweep/noise/PRBS waveforms |
| 5 | OOK protocols + TPMS | Protocol database + TPMS decode |
| 6 | IPC types | 8 AppIds + event types |
| 7 | App skeletons | All 8 compile |
| 8 | Runner | All 8 registered |
| 9 | Scanner/LG frontend | Components render |
| 10 | Other frontends | 6 components render |
| 11 | Switcher | All visible, builds pass |
| 12 | Tests | DSP + protocol tests pass |
