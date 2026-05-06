# Mayhem PC Phase 8b — Long-Tail: RF Characterization, Protocol Analyzer, Remote Control, IQ Player, SDR Benchmark, Freq Counter, CTCSS/DCS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 analysis/utility apps: RF Characterization, Protocol Analyzer, Remote Control, IQ File Player, SDR Benchmark, Frequency Counter, and CTCSS/DCS Decoder.

**Architecture:** These are measurement and analysis tools. RF Characterization uses TX sweep. Protocol Analyzer provides eye/constellation diagrams. Remote Control embeds a WebSocket server. IQ Player swaps file source for HackRF. CTCSS uses Goertzel tone detection.

**Spec reference:** `docs/superpowers/phase-specs/phase-8-long-tail.md`

---

## Task 1: RF Characterization (TX sweep)

**Files:**
- Create: `crates/mayhem-apps/src/rf_characterize.rs`
- Create: `frontend/src/apps/rf-char/RfCharApp.tsx`

- [ ] **Step 1: Implement sweep generator**

TX sweep across configurable frequency range. Measures nothing by itself (requires external RX) — outputs a stepped CW signal. IndoorTestOnly.

- [ ] **Step 2: Frontend — start/stop freq, step, dwell, progress bar**
- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/rf_characterize.rs frontend/src/apps/rf-char/
git commit -m "RF Characterization: TX frequency sweep generator (IndoorTestOnly)"
```

---

## Task 2: Protocol Analyzer (eye diagram + constellation)

**Files:**
- Create: `crates/mayhem-dsp/src/eye_diagram.rs`
- Create: `crates/mayhem-apps/src/protocol_analyzer.rs`
- Create: `frontend/src/apps/protocol-analyzer/ProtocolAnalyzerApp.tsx`

- [ ] **Step 1: Implement eye diagram computation**

```rust
//! Eye diagram: overlay multiple symbol periods to visualize signal quality.
//! Input: f32 samples at known symbol rate.
//! Output: 2D density map (time × amplitude) for rendering.

pub struct EyeDiagram {
    pub width: usize,   // samples per symbol period (time axis)
    pub height: usize,  // amplitude bins
    pub density: Vec<u32>, // width × height hit counts
}

pub fn compute_eye(samples: &[f32], samples_per_symbol: usize, height: usize) -> EyeDiagram {
    let width = samples_per_symbol * 2; // show 2 symbol periods
    let mut density = vec![0u32; width * height];

    for chunk in samples.chunks(width) {
        if chunk.len() < width { break; }
        for (x, &sample) in chunk.iter().enumerate() {
            let y = ((sample + 1.0) * 0.5 * (height - 1) as f32).round() as usize;
            let y = y.min(height - 1);
            density[y * width + x] += 1;
        }
    }

    EyeDiagram { width, height, density }
}
```

- [ ] **Step 2: App skeleton (live IQ or file input → symbol timing → eye + constellation)**
- [ ] **Step 3: Frontend — eye diagram canvas, constellation scatter plot, BER display**
- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/eye_diagram.rs crates/mayhem-apps/src/protocol_analyzer.rs frontend/src/apps/protocol-analyzer/ crates/mayhem-dsp/src/lib.rs
git commit -m "Protocol Analyzer: eye diagram + constellation display"
```

---

## Task 3: Remote Control (WebSocket server)

**Files:**
- Create: `crates/mayhem-apps/src/remote_control.rs`
- Create: `frontend/src/apps/remote-control/RemoteControlApp.tsx`

- [ ] **Step 1: Implement embedded WebSocket command server**

Listens on localhost:9090 (configurable). Accepts JSON commands matching Tauri command interface. Relays events back to connected clients.

```rust
// Uses tokio-tungstenite for WebSocket server.
// Commands: { "cmd": "start_app", "params": {...} }
// Events: forwarded from Tauri event bus.
// Security: localhost only by default. Optional token auth for LAN.
```

- [ ] **Step 2: Frontend — server status, connection list, access control settings**
- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/remote_control.rs frontend/src/apps/remote-control/
git commit -m "Remote Control: embedded WebSocket server for remote operation"
```

---

## Task 4: IQ File Player

**Files:**
- Create: `crates/mayhem-apps/src/iq_player.rs`
- Create: `frontend/src/apps/iq-player/IqPlayerApp.tsx`

- [ ] **Step 1: Implement IQ file player**

Replaces HackRF source with file source in any app's DSP chain. User selects a .cu8/.cs8/.cf32 file + target app → runs offline.

Simpler first slice: file → spectrum display (waterfall) + selectable demod (NFM, AM, SSB).

- [ ] **Step 2: Frontend — file picker, format selector, app selector, playback controls**
- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/iq_player.rs frontend/src/apps/iq-player/
git commit -m "IQ File Player: offline analysis with file source + selectable demod"
```

---

## Task 5: SDR Benchmark

**Files:**
- Create: `crates/mayhem-apps/src/sdr_benchmark.rs`
- Create: `frontend/src/apps/sdr-bench/SdrBenchApp.tsx`

- [ ] **Step 1: Implement benchmark app**

Measures: max sustained sample throughput, drop rate under load, IPC latency (backend→frontend), FFT computation time.

Runs synthetic load (no HackRF needed for most tests; optional hardware test).

- [ ] **Step 2: Frontend — test selector, run button, results table, pass/fail indicators**
- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/sdr_benchmark.rs frontend/src/apps/sdr-bench/
git commit -m "SDR Benchmark: throughput, drop rate, and latency measurement"
```

---

## Task 6: Frequency Counter

**Files:**
- Create: `crates/mayhem-apps/src/freq_counter.rs`
- Create: `frontend/src/apps/freq-counter/FreqCounterApp.tsx`

- [ ] **Step 1: Implement frequency counter**

High-precision frequency measurement via FFT peak interpolation (parabolic or Quinn's method). Configurable gate time. Displays frequency with sub-Hz resolution.

- [ ] **Step 2: Frontend — large frequency display, gate time selector, averaging, hold**
- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-apps/src/freq_counter.rs frontend/src/apps/freq-counter/
git commit -m "Frequency Counter: FFT peak interpolation with sub-Hz precision"
```

---

## Task 7: CTCSS/DCS Decoder

**Files:**
- Create: `crates/mayhem-dsp/src/ctcss.rs`
- Create: `crates/mayhem-apps/src/ctcss_dcs.rs`
- Create: `frontend/src/apps/ctcss-dcs/CtcssDcsApp.tsx`

- [ ] **Step 1: Implement CTCSS tone detector**

```rust
//! CTCSS (Continuous Tone-Coded Squelch System) detector.
//! Detects sub-audible tones (67.0 – 254.1 Hz) using Goertzel filters.
//! Also decodes DCS (Digital-Coded Squelch) — 134.4 bps FSK below 300 Hz.

/// Standard CTCSS tone frequencies (38 tones per EIA/TIA-603).
pub const CTCSS_TONES: [f32; 38] = [
    67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
    97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
    136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
    192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3,
];

/// Detect CTCSS tone from FM-demodulated audio.
/// Returns the detected tone frequency, or None.
pub fn detect_ctcss(audio: &[f32], sample_rate: f32) -> Option<f32> {
    let block_size = (sample_rate * 0.4) as usize; // 400ms window
    if audio.len() < block_size { return None; }

    let mut best_tone = 0.0f32;
    let mut best_power = 0.0f32;

    for &freq in &CTCSS_TONES {
        let power = goertzel_power(audio, freq, sample_rate, block_size);
        if power > best_power {
            best_power = power;
            best_tone = freq;
        }
    }

    // Threshold: tone must be significantly above noise
    let noise_floor = estimate_noise(audio, sample_rate, block_size);
    if best_power > noise_floor * 10.0 {
        Some(best_tone)
    } else {
        None
    }
}

fn goertzel_power(samples: &[f32], freq: f32, sample_rate: f32, n: usize) -> f32 {
    let k = (freq * n as f32 / sample_rate).round();
    let coeff = 2.0 * (2.0 * std::f32::consts::PI * k / n as f32).cos();
    let mut s1 = 0.0f32;
    let mut s2 = 0.0f32;
    for &sample in samples.iter().take(n) {
        let s0 = sample + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    s1 * s1 + s2 * s2 - coeff * s1 * s2
}

fn estimate_noise(samples: &[f32], sample_rate: f32, n: usize) -> f32 {
    // Measure power at a frequency known to have no CTCSS (e.g., 50 Hz)
    goertzel_power(samples, 50.0, sample_rate, n)
}
```

- [ ] **Step 2: App implementation (standalone or NFM addon mode)**
- [ ] **Step 3: Frontend — detected tone display, DCS code display, squelch indicator**
- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-dsp/src/ctcss.rs crates/mayhem-apps/src/ctcss_dcs.rs frontend/src/apps/ctcss-dcs/ crates/mayhem-dsp/src/lib.rs
git commit -m "CTCSS/DCS Decoder: sub-audible tone detection (38 standard tones)"
```

---

## Task 8: Runner + switcher integration

- [ ] **Step 1: Register all 7 Phase 8b apps**
- [ ] **Step 2: Add to switcher, verify build**
- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/runner.rs frontend/src/App.tsx crates/mayhem-ipc/src/lib.rs crates/mayhem-apps/src/lib.rs
git commit -m "Phase 8b integration: register 7 analysis/utility apps, update switcher"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | RF Characterization | TX sweep, IndoorTestOnly |
| 2 | Protocol Analyzer | Eye diagram computes |
| 3 | Remote Control | WebSocket server starts |
| 4 | IQ File Player | File → spectrum display |
| 5 | SDR Benchmark | Throughput test runs |
| 6 | Frequency Counter | FFT peak interpolation |
| 7 | CTCSS/DCS | 38 tones detected |
| 8 | Integration | All registered, builds pass |
