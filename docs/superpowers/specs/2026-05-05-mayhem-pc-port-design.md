# Mayhem PC Port — Design

**Date:** 2026-05-05
**Status:** Draft (awaiting user approval)

## Summary

Reimplement the functional capabilities of the [PortaPack Mayhem firmware](https://github.com/portapack-mayhem/mayhem-firmware) as a desktop application that runs on macOS, Linux, and Windows with a HackRF One as the only required hardware. The PortaPack hardware extension is not required.

The result is a Tauri application — Rust backend, React/TypeScript frontend — that exposes Mayhem's apps (receivers, transmitters, utilities) through a PC-native UI. This is **not** a port of the embedded firmware, the ChibiOS RTOS, or the LCD-style UI. It is a reimplementation of Mayhem's *functional* features against PC-side abstractions.

## 1. Goals & non-goals

### Goals
- Cross-platform desktop app (macOS, Linux, Windows). Single Tauri binary per platform.
- HackRF One via USB; no PortaPack hardware required.
- Reimplement every legitimate Mayhem app (~118 of ~130) over time, across phases.
- Reuse Mayhem's algorithms (DSP techniques, protocol decoders) by reimplementing them in Rust — not by translating C++ line-by-line.
- Validate the architecture end-to-end with v0.1 before scaling to additional apps.
- DSP and protocol layers must be testable without hardware.

### Non-goals
- Not a port of the embedded UI, ChibiOS RTOS, or LPC4320 boot/bootstrapping code.
- Not a C++→TypeScript translation. Apps live in Rust; TypeScript is the UI layer only.
- Not a single-binary firmware emulator.
- Not aiming for feature parity at v1; "every app" is a north star, not a release gate.
- No RTL-SDR / multi-SDR support in v0.1 (architecture won't preclude it).
- Not porting the 12 refused apps (see §6).

## 2. Architecture

### High-level

A single Tauri binary contains:
- **Rust backend** owns the HackRF, runs FutureSDR flowgraphs, and houses all DSP + protocol code.
- **React/TypeScript frontend** runs in the Tauri WebView, renders UI, and consumes data via Tauri IPC.
- **Web Audio API** in the frontend handles audio output. No native audio crate in v0.1.

```
[ HackRF One ] <-- USB --> [ Rust backend ] <-- IPC --> [ React WebView ]
                            (FutureSDR)                  (UI + Web Audio)
```

### Why Tauri (not Electron)
- Rust backend is built into the app — no separate sidecar process.
- Smaller binary (~10 MB vs ~150 MB).
- IPC is `#[tauri::command]` function calls, not stdio piping.
- React/TS frontend dev experience is the same as Electron.

### Why FutureSDR (not roll-your-own DSP)
- HackRF source/sink built in.
- Standard SDR dataflow architecture (à la GNU Radio).
- Block reuse across apps cuts per-app effort 3–5×.
- Async runtime handles backpressure correctly.

### IPC structure

Two channels:
- **Commands** (frontend → backend): tune, gain, start/stop, app-specific params. Tauri's `#[tauri::command]`.
- **Events / streams** (backend → frontend): spectrum frames, decoded data, audio PCM, status. Tauri events.

If event throughput proves insufficient (validated in week-1 spike), fall back to a localhost WebSocket inside the Tauri binary.

## 3. Repo structure

```
mayhem-pc/
├── Cargo.toml                   # workspace root
├── crates/
│   ├── mayhem-radio/            # HackRF + FutureSDR primitives
│   ├── mayhem-dsp/              # reusable DSP blocks (FM, AM, FSK, OOK, PPM, FFT, ...)
│   ├── mayhem-protocols/        # pure-function protocol codecs (POCSAG, ADS-B, AIS, ...)
│   ├── mayhem-apps/             # one module per Mayhem app + AppRegistry + App trait
│   └── mayhem-ipc/              # serde IPC types; ts-rs/specta auto-gen for frontend
├── src-tauri/                   # Tauri shell, command handlers, event dispatch
├── frontend/                    # React + TypeScript (Vite + Zustand)
│   ├── src/
│   │   ├── apps/                # one component dir per app (nfm-audio/, adsb/, pocsag-tx/)
│   │   ├── components/          # Waterfall, TuningControls, AudioSink, MapView
│   │   ├── ipc/                 # Tauri command/event wrappers
│   │   └── store/               # Zustand
└── docs/
```

### Module boundaries

- **`mayhem-dsp`** is hardware- and protocol-agnostic. Pure FutureSDR blocks operating on `Complex<f32>` / `f32`. Reused across apps.
- **`mayhem-protocols`** is pure functions. Bytes/symbols in, decoded structs out. No DSP, no I/O. Unit-testable with byte fixtures.
- **`mayhem-apps`** is the only place that knows about flowgraphs. Each app implements an `App` trait and registers with `AppRegistry`.
- **`mayhem-ipc`** is the single source of truth for IPC contracts. TypeScript types auto-generated from Rust via `ts-rs` (or `specta` — final pick deferred to implementation plan).
- **Frontend never imports radio or DSP concepts.** It knows only about apps, commands, and events. The radio backend is swappable behind this boundary.

### `App` trait sketch

```rust
pub trait App {
    fn metadata() -> AppMetadata;
    fn start(&self, params: serde_json::Value) -> Result<RunningApp>;
}

pub struct AppMetadata {
    pub id: AppId,
    pub name: &'static str,
    pub regulatory_class: RegulatoryClass,
    pub direction: Direction, // Rx, Tx, Both
}

pub enum RegulatoryClass {
    Passive,           // RX only — universally legal
    AmateurOnly,       // requires amateur license + correct band
    OwnDevicesOnly,    // testing your own equipment
    IndoorTestOnly,    // dummy load, indoor only — never on-air
}
```

The 12 refused apps (§6) do not have modules at all — not hidden behind a flag, just absent.

## 4. v0.1 vertical slice

Three apps, combined, validate the entire architecture: **NFM RX**, **ADS-B RX**, **POCSAG TX**.

### NFM Audio Receiver
Tune to a frequency, see live spectrum + waterfall, hear demodulated audio.
- DSP: HackRF source @ 2.4 Msps → decimation → FIR LPF → quad demod → audio resample to 48 kHz → IPC.
- UI: waterfall canvas, frequency input, gain sliders (LNA/VGA/AMP), squelch, audio playback (Web Audio AudioWorklet ring buffer).

### ADS-B Receiver
Decode aircraft messages, show in table and on map.
- DSP: HackRF source @ 2 Msps fixed @ 1090 MHz → preamble detect → PPM slicer → bit pack → DF17 decoder → CPR position decode.
- UI: optional waterfall, aircraft table, MapLibre GL JS map (OSM tiles, GPU-rendered symbol layer for icons).

### POCSAG Transmitter
Encode and transmit pages.
- DSP: text → POCSAG codeword (preamble + sync + batch + BCH ECC) → 2-FSK Gaussian shaping → HackRF sink.
- UI: RIC, function bits (A/B/C/D), message text, baud (512/1200/2400), arm/disarm two-step.
- **Legal banner required per session**: "amateur license + appropriate band; do not transmit on commercial paging frequencies."
- Safety: default frequency = 0 (forces user input); session timeout; cannot transmit while RX is running on same device.

### Acceptance criteria — v0.1 "done"

1. NFM: tune to a local broadcast, hear ≥ 60 s of clean audio with no underruns.
2. NFM: waterfall ≥ 20 fps with no tearing.
3. ADS-B: with antenna near a window, ≥ 1 aircraft within 5 minutes.
4. ADS-B: position update on map within 2 s of decode.
5. App switcher: NFM ↔ ADS-B ↔ POCSAG TX cleanly stops/starts flowgraphs (no leaked threads, no audio leak, no HackRF deadlock).
6. Zero RAM growth over 30 min in any app (backpressure sanity check).
7. POCSAG TX: encoded message decodes correctly on a separate SDR running multimon-ng, at all three baud rates.
8. POCSAG TX: arm/disarm flow works; legal banner gates first transmission per session.
9. RX → TX → RX mode-switching has no deadlocks (loop 100 times).

### Out of scope for v0.1

- All other apps.
- Recording/replay (`capture_app`).
- Multi-SDR.
- Settings persistence beyond last-tuned frequency in NFM.
- Frequency manager.
- Plugin system.
- Auto-update.
- Code signing / installer packaging beyond plain .dmg / AppImage / .exe builds.

### Rough timeline

~10–14 weeks of evening/weekend pace, single developer, given a new architecture. Not a commitment.

## 5. Long-term roadmap

The roadmap groups apps by the building blocks they share so each phase has compounding leverage. Order is indicative; phases will overlap.

| Phase | Theme | Apps | New shared building blocks |
|---|---|---|---|
| 0 (v0.1) | Architecture validation | NFM RX, ADS-B RX, POCSAG TX (3) | Everything from §3 |
| 1 | Voice & audio family | WFM, AM, USB/LSB/CW, RDS (~6) | SSB demod, RDS BPSK |
| 2 | FM-family digital | APRS, AIS, ACARS, ERT, weather station, sonde RX, AFSK utils, two_tone_pager RX (~10) | FM symbol slicers, AX.25 decoder, NMEA assembly |
| 3 | OOK / sub-GHz capture | TPMS RX, OOK editor RX, scanner, recon, looking_glass, signal generator, OOK protocol decoders (~8) | OOK pulse-distance/PWM analyzer |
| 4 | Specialty receivers | NOAA APT, DSC, EPIRB RX, sonde decoders (RS41/M10), DAB-lite (~6–8) | Each is its own DSP project |
| 5 | Amateur TX expansion | RTTY TX, SSTV TX, FLEX TX, AFSK TX, morse TX, soundboard (~6) | Reuses Phase 0 TX scaffolding |
| 6 | Dual-use specialty TX | ADS-B TX, gpssim, mdc_tx, replay TX, OOK editor TX, hopper, BTLE TX, NRF TX, RFM69 TX, flippertx, keyfob, lge, bht_tx (~12) | RegulatoryClass enforcement, per-band lockouts |
| 7 | Utilities, file tools, games | file manager, freqman, playlist, settings, calculator, snake, doom, etc. (~30) | UI-only; no DSP |
| 8 | Long-tail / hard | BTLE comm/sniffing, NRF sniffing, encoders pile, niche apps (~20) | Heterogeneous |

Total: ~118 apps across the roadmap. The 12 refused apps in §6 are excluded permanently.

## 6. Refused apps

12 of Mayhem's apps will not be ported. The repo will not contain modules for them. The omissions are at the source level — not behind a flag.

### RF denial of service / harassment
- `jammer` — RF DoS (47 U.S.C. § 333).
- `blespam` — BLE advertisement spam exploiting iOS/Android crash bugs; pure harassment.
- `cvs_spam` — replays customer-assistance-button signals; targeted harassment of a specific business.

### Spoofing public-safety / emergency systems
- `same_tx` — fake EAS/NWS emergency alert tones (FCC § 11.45).
- `p25_tx` — impersonates police/fire/EMS digital radio.
- `epirb_tx` — false distress beacons; triggers Coast Guard / SAR response.
- `two_tone_pager` (TX side only; RX is permitted) — fire/EMS dispatch tone spoofing.

### Unauthorized access to others' property / services
- `ookbrute` — brute-forces OOK codes against arbitrary targets. (Your own remote does not require brute force.)
- `keeloqtx` — KeeLoq rolling-code TX, designed to send codes captured from others' vehicles/doors.
- `touchtunes` — unauthorized control of commercial TouchTunes jukeboxes.
- `shoppingcart_lock` — disables retailer anti-theft wheel locks.

### Nonconsensual / sexual harassment
- `adult_toys_controller` — code derived from `ble_spam/protocols/lovespouse`; designed to activate strangers' BLE adult toys without consent.

The `RegulatoryClass` system exists to make accidental misuse of the *permitted* dual-use apps hard. It is not a substitute for refusing the 12 above.

## 7. Testing

The DSP and protocol layers must be testable without a HackRF.

1. **`mayhem-protocols` unit tests** — pure functions over byte/symbol sequences. Fixtures are real-world captures (POCSAG, ADS-B, AIS, ...) committed under `crates/mayhem-protocols/tests/fixtures/`.
2. **`mayhem-dsp` unit tests** — known I/Q sample files (`.cs8`/`.cu8`/`.cf32`) through DSP blocks; assert output bytes/symbols. FutureSDR file source as test harness.
3. **`mayhem-apps` integration tests** — full flowgraphs with a file source swapped in for the HackRF source. Every app gets a regression test that does not need hardware.

**Frontend.** Vitest + Testing Library for components with mocked IPC. Playwright for end-to-end against a backend in test mode.

**Manual hardware tests.** Per-app checklist; required before declaring an app shipped. Antenna sensitivity, audio quality, real RF environment.

**TX validation.** Every TX app: transmit into a dummy load, capture with a second SDR, decode with an independent open-source tool (multimon-ng, dump1090, etc.). Round-trip through reference tooling — never self-decode.

## 8. Risks

| Risk | Mitigation |
|---|---|
| FutureSDR HackRF block maturity, especially TX | Week-1 spike: continuous source/sink @ 2.4 Msps for 30 min, measure underruns. If broken, use the `hackrf` crate directly with custom FutureSDR wrappers. |
| Tauri IPC throughput (audio + spectrum) | Spike before any UI work: synthetic stream test. If too slow, localhost WebSocket inside the Tauri binary. |
| USB latency on macOS | Document; tune via larger libusb transfer buffers. May affect tight TX timing. |
| RX → TX mode-switch deadlock | Acceptance criterion #9. Owned `Hackrf` mutex with explicit state machine if needed. |
| MapLibre perf with many aircraft | GPU symbol layer (not DOM markers); throttle position updates to 1 Hz per aircraft. |
| Regulatory metadata circumvention | Accepted. The system makes accidental misuse hard, not deliberate misuse impossible. The 12 refused apps are out at the source level. |

## 9. Open questions (deferred — flagged here, not blocking v0.1)

1. **External apps / plugin system.** Mayhem supports user-loaded externals via DFU. Nothing in v0.1; long-term answer probably WASM-sandboxed plugins (Phase 8+).
2. **Multi-SDR support.** Architecture allows it (radio crate is abstracted). RTL-SDR via SoapySDR is a future RX-only nice-to-have.
3. **Settings persistence.** Probably TOML in OS app-data dir (Tauri provides paths). Format details deferred to implementation plan.
4. **Frequency manager (`freqman`) compatibility.** Aim to read Mayhem's freqman text format so users with existing files can drop them in. Format details deferred.
