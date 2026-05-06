# Phase 3 — OOK / Sub-GHz Capture & Analysis

**Theme:** Capture, analyze, and decode On-Off Keying (OOK) and simple FSK signals in the sub-GHz ISM bands (315, 433, 868, 915 MHz). These apps share a common capture-and-analyze pipeline rather than targeting a single protocol.

**Shared building blocks (new in this phase):**
- OOK envelope detector + threshold — extract pulse train from raw IQ.
- Pulse analyzer (pulse-distance, pulse-width, pulse-position classification).
- Protocol pattern matcher — match captured pulse trains against known device databases.
- Wideband scanner engine — sweep across frequency range, measure energy per bin.
- Signal generator (CW, sweep, noise) — test/calibration tool using HackRF sink.

---

## Apps

| # | App | Description | Key Capability | Key UI Elements |
|---|-----|-------------|----------------|-----------------|
| 1 | TPMS RX | Tire Pressure Monitoring decode | OOK/FSK @ 315/433 MHz → TPMS packet decode | Sensor table (ID, pressure, temp), signal strength |
| 2 | OOK Analyzer RX | Capture and visualize OOK pulse trains | Envelope → pulse timing → pattern display | Pulse timeline, timing histogram, protocol guess |
| 3 | Scanner | Frequency scanner with configurable ranges | Wideband energy detect, squelch-based stop | Frequency list, signal bars, hold/resume, scan speed |
| 4 | Recon | Enhanced scanner with signal characterization | Scanner + modulation classifier + bandwidth estimate | Signal table (freq, mod type, BW, strength), waterfall |
| 5 | Looking Glass | Wideband spectrum overview (like SDR# panorama) | FFT across full HackRF range in sweeps | Full-band waterfall/spectrum, zoom select |
| 6 | Signal Generator | Generate test signals (CW, FM, AM, sweep, noise) | HackRF sink with configurable waveform | Waveform selector, frequency, amplitude, sweep params |
| 7 | OOK Protocol Decoders | Decode known OOK protocols (doorbells, sensors, remotes) | Pattern match → protocol-specific decode | Decoded device table, raw pulse view, protocol selector |
| 8 | Sub-GHz Capture | Record raw OOK/FSK bursts for offline analysis | Triggered capture with adjustable threshold | Capture list, export (`.sub` compatible format) |

---

## Shared DSP Blocks

### 1. OOK Envelope Detector (`ook_envelope.rs`)
- **Input:** Complex IQ samples.
- **Steps:** Magnitude (|IQ|) → moving-average smoothing → adaptive threshold.
- **Output:** Binary pulse train (high/low) with timestamps.
- **Params:** smoothing_window, threshold_factor (above noise floor).

### 2. Pulse Analyzer (`pulse_analyze.rs`)
- **Input:** Binary pulse train with timestamps.
- **Analysis:**
  - Measure pulse durations and gap durations.
  - Cluster into short/long (or multi-level).
  - Classify encoding: pulse-distance, pulse-width, Manchester, raw.
  - Compute symbol rate estimate.
- **Output:** `PulseAnalysis { encoding, symbol_rate, pulses: Vec<PulseEvent> }`.

### 3. Protocol Matcher (`ook_protocols.rs` in mayhem-protocols)
- **Input:** Classified pulse pattern.
- **Database:** Known protocols with timing specs (e.g., PT2262: short=300µs, long=900µs, sync=9300µs).
- **Output:** Protocol identification + decoded payload if known.
- **Extensible:** New protocols added as data entries, not code.

### 4. Wideband Scanner (`scanner_engine.rs`)
- **Method:** Rapid retune + short FFT capture per step.
- **Params:** start_hz, stop_hz, step_hz, dwell_ms, squelch_db.
- **Output:** Stream of `ScanResult { freq_hz, power_db, timestamp }`.
- **Used by:** Scanner, Recon, Looking Glass (different UIs over same engine).

### 5. Signal Generator (`sig_gen.rs`)
- **Waveforms:** CW (single tone), two-tone, FM chirp/sweep, AM modulated, white noise, PRBS.
- **Output:** Complex IQ samples → HackRF sink.
- **Safety:** RegulatoryClass::IndoorTestOnly. Must be armed. Legal banner.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| TPMS RX | OOK capture @ 315 MHz → known TPMS formats (Schrader, Sensata) | Multi-protocol, tire position mapping |
| OOK Analyzer RX | Capture + pulse timeline display + timing stats | Auto-protocol guess, export |
| Scanner | Step-tune across range, display energy bars | Squelch stop, bookmark signals |
| Recon | Scanner + modulation classification column | Bandwidth estimate, auto-record |
| Looking Glass | Sweep full band, render waterfall | Zoom-to-tune (click → start NFM) |
| Signal Generator | CW tone at configurable frequency | Sweep, two-tone, noise |
| OOK Protocol Decoders | 3–5 common protocols (PT2262, EV1527, doorbell) | Extensible database |
| Sub-GHz Capture | Triggered burst record + raw export | Flipper `.sub` format compatibility |

---

## Implementation Notes

- **Scanner/Recon/Looking Glass share the scanner engine** — they differ primarily in UI presentation and post-processing. Implement the engine once; each app is a thin wrapper with its own frontend component.
- **TPMS overlaps with Phase 2's ERT** in that both are ISM-band sensor protocols. Placed here because TPMS uses OOK pulse analysis rather than structured packet framing.
- **Signal Generator requires TX** — uses the HackRF sink from Phase 0 (Plan 3). RegulatoryClass::IndoorTestOnly applies; same arm/disarm + legal banner flow.
- **Sub-GHz Capture is a "record now, decode later" tool** — saves raw pulse data. Future: compatibility with Flipper Zero `.sub` file format for community interop.
- **OOK Protocol database** should be data-driven (TOML/JSON definitions per protocol) so users can add protocols without recompiling. Implementation detail deferred to the plan.
- **Looking Glass** requires rapid retuning of the HackRF. The HackRF supports fast tune (~1 ms) so sweeping 0–6 GHz in ~6000 steps at 1 ms each = ~6 s per sweep. Acceptable for a panoramic view.
