# Mayhem PC Phase 8a — Long-Tail: BTLE RX, BTLE Comm, NRF24 Sniffer, Encoder Suite, Decoder Suite, Capture Manager, Spectrum Painter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 heterogeneous apps: BTLE RX (sniffer), BTLE Comm, NRF24 Sniffer, Encoder Suite, Decoder Suite, Capture/Replay Manager, and Spectrum Painter.

**Architecture:** BLE/NRF24 apps use GFSK demod at 2.4 GHz. Encoder/Decoder suites are data-driven (protocol definitions). Capture Manager extends Phase 6's replay with tagging. Spectrum Painter converts images to IQ via IFFT.

**Spec reference:** `docs/superpowers/phase-specs/phase-8-long-tail.md`

---

## Task 1: BTLE RX (advertisement sniffer)

**Files:**
- Create: `crates/mayhem-apps/src/btle_rx.rs`
- Modify: `crates/mayhem-ipc/src/lib.rs`
- Create: `frontend/src/apps/btle-rx/BtleRxApp.tsx`

- [ ] **Step 1: Implement BLE sniffer app**

DSP: HackRF @ 2.402 GHz (ch37) → GFSK demod 1 Mbps → access address match (0x8E89BED6) → dewhiten → CRC check → PDU parse → emit.

- [ ] **Step 2: Frontend — advertisement list (MAC, type, RSSI, AD data)**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/btle_rx.rs crates/mayhem-ipc/src/lib.rs frontend/src/apps/btle-rx/
git commit -m "BTLE RX: advertisement channel sniffer (ch37/38/39, PDU decode)"
```

---

## Task 2: BTLE Comm (scan + basic connection)

**Files:**
- Create: `crates/mayhem-apps/src/btle_comm.rs`
- Create: `frontend/src/apps/btle-comm/BtleCommApp.tsx`

- [ ] **Step 1: Implement BLE comm app (scan mode first)**

First slice: scan and display all advertisements with decoded AD structures (name, flags, service UUIDs). Connection is stretch (HackRF timing limitations).

- [ ] **Step 2: Frontend — device list with expandable AD details**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/btle_comm.rs frontend/src/apps/btle-comm/
git commit -m "BTLE Comm: scan mode with AD structure decode (connection deferred)"
```

---

## Task 3: NRF24 Sniffer

**Files:**
- Create: `crates/mayhem-apps/src/nrf24_rx.rs`
- Create: `frontend/src/apps/nrf24-rx/Nrf24RxApp.tsx`

- [ ] **Step 1: Implement NRF24 sniffer**

DSP: HackRF @ 2.4 GHz + channel offset → GFSK demod (1 Mbps) → address match → payload extract → emit.

Configuration: target address (hex), channel (0-125), data rate.

- [ ] **Step 2: Frontend — packet list (address, payload hex, channel, RSSI)**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/nrf24_rx.rs frontend/src/apps/nrf24-rx/
git commit -m "NRF24 Sniffer: single-channel packet capture with known address"
```

---

## Task 4: Encoder Suite (multi-protocol OOK TX)

**Files:**
- Create: `crates/mayhem-apps/src/encoder_suite.rs`
- Create: `frontend/src/apps/encoder-suite/EncoderSuiteApp.tsx`

- [ ] **Step 1: Implement encoder suite app**

Data-driven: loads protocol definitions (PT2262, EV1527, Came, NICE, Linear, SMC5326, Holtek). User selects protocol → enters address/data bits → preview pulse train → TX.

Reuses Phase 6b keyfob encoder as the core, with more protocols added.

RegulatoryClass::OwnDevicesOnly.

- [ ] **Step 2: Frontend — protocol selector, bit input grid, pulse preview, TX**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/encoder_suite.rs frontend/src/apps/encoder-suite/
git commit -m "Encoder Suite: multi-protocol OOK TX (PT2262, EV1527, Came, NICE, etc.)"
```

---

## Task 5: Decoder Suite (multi-protocol OOK RX)

**Files:**
- Create: `crates/mayhem-apps/src/decoder_suite.rs`
- Create: `frontend/src/apps/decoder-suite/DecoderSuiteApp.tsx`

- [ ] **Step 1: Implement decoder suite app**

Captures OOK signal → runs through all registered protocol matchers simultaneously → displays decoded results. Similar to rtl_433's multi-protocol approach.

Reuses Phase 3 OOK envelope + pulse analyzer + protocol database.

- [ ] **Step 2: Frontend — decoded device list (protocol, code, bit count, timestamp)**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/decoder_suite.rs frontend/src/apps/decoder-suite/
git commit -m "Decoder Suite: multi-protocol simultaneous OOK decode (rtl_433-style)"
```

---

## Task 6: Capture/Replay Manager

**Files:**
- Create: `crates/mayhem-apps/src/capture_manager.rs`
- Create: `frontend/src/apps/capture-manager/CaptureManagerApp.tsx`

- [ ] **Step 1: Implement capture manager**

Enhancement over Phase 6a Replay TX:
- Triggered recording (threshold-based auto-start).
- Metadata tagging (protocol, device, notes, timestamp).
- Browse/search captured signals.
- Selective replay (trim start/end).
- Export in multiple formats (.cu8, .cs8, .wav).

- [ ] **Step 2: Frontend — capture list, waveform preview, metadata editor, replay controls**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/capture_manager.rs frontend/src/apps/capture-manager/
git commit -m "Capture/Replay Manager: triggered record, tag, browse, selective replay"
```

---

## Task 7: Spectrum Painter

**Files:**
- Create: `crates/mayhem-dsp/src/spectrum_paint.rs`
- Create: `crates/mayhem-apps/src/spectrum_painter.rs`
- Create: `frontend/src/apps/spectrum-painter/SpectrumPainterApp.tsx`

- [ ] **Step 1: Implement spectrum painter DSP**

```rust
//! Spectrum Painter: converts image to IQ samples.
//! Each row of the image becomes one FFT frame:
//! - Pixel brightness → FFT bin amplitude
//! - IFFT → time-domain IQ samples
//! - Concatenate rows → continuous IQ stream → HackRF sink

use futuresdr::num_complex::Complex32;
use std::f32::consts::PI;

/// Convert grayscale image to IQ samples for spectrum painting.
///
/// - `image`: row-major grayscale pixels (0-255), width × height.
/// - `width`: FFT size (should be power of 2, e.g., 1024).
/// - `height`: number of rows (time dimension).
/// - `row_duration_samples`: samples per row (controls "scroll speed").
pub fn paint_to_iq(image: &[u8], width: usize, height: usize, row_duration_samples: usize) -> Vec<Complex32> {
    let mut iq = Vec::with_capacity(height * row_duration_samples);

    for row in 0..height {
        // Build frequency-domain representation
        let mut freq_domain = vec![Complex32::new(0.0, 0.0); width];
        for col in 0..width {
            let pixel = image[row * width + col] as f32 / 255.0;
            // Random phase for each bin to avoid impulse-like time domain
            let phase = (row as f32 * 0.1 + col as f32 * 0.7) * PI;
            freq_domain[col] = Complex32::new(pixel * phase.cos(), pixel * phase.sin());
        }

        // IFFT (simple DFT for correctness; production would use FFT crate)
        let time_domain = simple_ifft(&freq_domain);

        // Stretch or compress to desired row duration
        let samples_per_fft = width;
        let repeats = (row_duration_samples + samples_per_fft - 1) / samples_per_fft;
        for _ in 0..repeats {
            iq.extend_from_slice(&time_domain[..samples_per_fft.min(row_duration_samples - iq.len() % row_duration_samples)]);
        }
    }

    iq
}

fn simple_ifft(freq: &[Complex32]) -> Vec<Complex32> {
    let n = freq.len();
    let mut time = vec![Complex32::new(0.0, 0.0); n];
    let scale = 1.0 / n as f32;
    for k in 0..n {
        let mut sum = Complex32::new(0.0, 0.0);
        for j in 0..n {
            let angle = 2.0 * PI * j as f32 * k as f32 / n as f32;
            let twiddle = Complex32::new(angle.cos(), angle.sin());
            sum += freq[j] * twiddle;
        }
        time[k] = sum * scale;
    }
    time
}
```

- [ ] **Step 2: Implement app (IndoorTestOnly, arm/disarm)**

- [ ] **Step 3: Frontend — image upload/drop, preview, bandwidth control, TX**

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/spectrum_paint.rs crates/mayhem-apps/src/spectrum_painter.rs frontend/src/apps/spectrum-painter/ crates/mayhem-dsp/src/lib.rs
git commit -m "Spectrum Painter: image → IFFT → wideband TX (visible on waterfall)"
```

---

## Task 8: Runner + switcher integration

- [ ] **Step 1: Register all 7 apps in runner**
- [ ] **Step 2: Add to frontend switcher**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/runner.rs frontend/src/App.tsx crates/mayhem-ipc/src/lib.rs
git commit -m "Phase 8a integration: register 7 apps, update switcher"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | BTLE RX | Adv channel sniff, PDU decode |
| 2 | BTLE Comm | Scan mode, AD structure display |
| 3 | NRF24 Sniffer | Single-channel capture |
| 4 | Encoder Suite | Multi-protocol OOK TX |
| 5 | Decoder Suite | Multi-protocol simultaneous RX |
| 6 | Capture Manager | Record, tag, browse, replay |
| 7 | Spectrum Painter | Image → IQ → TX |
| 8 | Integration | All registered, builds pass |
