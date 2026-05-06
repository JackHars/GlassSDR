# Phase 1 — Voice & Audio Family

**Theme:** Extend the NFM receiver into a full analog voice/audio suite. Each app shares the same DSP backbone (HackRF source → decimation → demodulator → audio resample → Web Audio) but swaps the demodulator and adds mode-specific UI.

**Shared building blocks (new in this phase):**
- SSB demodulator (Weaver or phasing method) — used by USB, LSB, CW.
- AM envelope detector — simple magnitude after downconversion.
- RDS BPSK demodulator + Group decoder — rides on WFM's 57 kHz subcarrier.
- Stereo pilot/matrix decoder — for WFM stereo (19 kHz pilot → L/R separation).
- Audio bandpass filter bank — configurable per mode (300–3000 Hz for SSB, 200–800 Hz for CW, 50–15000 Hz for WFM).

---

## Apps

| # | App | Description | Demod | Key UI Elements |
|---|-----|-------------|-------|-----------------|
| 1 | WFM RX | Wideband FM broadcast receiver | FM discriminator (200 kHz deviation) + de-emphasis + stereo decode | Waterfall, stereo indicator, RDS text overlay, volume |
| 2 | AM RX | Amplitude modulation receiver | Envelope detector (magnitude) | Waterfall, AGC indicator, frequency display |
| 3 | USB RX | Upper sideband (SSB) | Weaver/phasing SSB demod, upper sideband | Waterfall, tuning knob (fine), BFO offset, bandwidth control |
| 4 | LSB RX | Lower sideband (SSB) | Same as USB but lower sideband select | Same as USB |
| 5 | CW RX | Morse code receiver | SSB demod + narrow BPF (400–800 Hz) + optional tone decoder | Waterfall (narrow), pitch control, WPM display (optional) |
| 6 | RDS RX | RDS data decoder (extends WFM) | WFM demod → 57 kHz BPSK subcarrier → Group decoder | Station name (PS), radio text (RT), program type, clock |

---

## Shared DSP Blocks

### 1. SSB Demodulator (`ssb_demod.rs`)
- **Method:** Weaver (third-method) — multiply by BFO, LPF, select sideband via sign of offset.
- **Inputs:** Complex IQ at baseband sample rate (after decimation).
- **Params:** sideband (upper/lower), BFO offset Hz, audio bandwidth Hz.
- **Output:** real f32 audio samples.

### 2. AM Envelope Detector (`am_demod.rs`)
- **Method:** `|I + jQ|` = sqrt(I² + Q²), then DC-block filter.
- **AGC:** Simple peak-tracking AGC with configurable attack/release.
- **Output:** real f32 audio samples.

### 3. WFM Stereo Decoder (`stereo_decode.rs`)
- **Input:** Wideband FM-demodulated baseband (mono+stereo+RDS composite).
- **Steps:**
  1. Detect 19 kHz pilot (PLL lock).
  2. Double pilot → 38 kHz, multiply with composite to extract L−R.
  3. Matrix: L = (L+R) + (L−R), R = (L+R) − (L−R).
- **Output:** two-channel f32 audio (or mono fallback if no pilot).

### 4. RDS Demodulator (`rds_demod.rs`)
- **Input:** WFM composite signal.
- **Steps:**
  1. Bandpass around 57 kHz (third harmonic of pilot).
  2. BPSK demodulation (Costas loop or decision-directed).
  3. Bit sync + differential decode.
  4. Group assembly (4 × 26-bit blocks, each with 10-bit CRC checkword).
- **Output:** RDS Group structs (PI, PS, RT, CT, PTY).

### 5. Audio Bandpass / AGC (`audio_filter.rs`)
- Configurable Butterworth IIR bandpass.
- Per-mode presets: CW (400–800 Hz), SSB (300–3000 Hz), AM (100–5000 Hz), WFM (50–15000 Hz).

---

## Suggested Per-App First Slice

| App | First slice (minimal viable) | Stretch |
|-----|------------------------------|---------|
| WFM RX | Mono WFM demod + audio + waterfall | Stereo, RDS text |
| AM RX | Envelope detect + audio + waterfall | AGC meter |
| USB RX | SSB demod (upper) + audio + waterfall | Fine-tune dial |
| LSB RX | Same as USB with sideband flip | — |
| CW RX | SSB + narrow BPF + audio | Tone decoder / WPM |
| RDS RX | Combine WFM + RDS pipeline, text display | Full group decode (CT, AF, EON) |

---

## Implementation Notes

- **WFM sample rate:** Requires wider bandwidth capture (~250 kHz). Use 2.4 Msps source but increase the channel filter bandwidth (no additional decimation, or decimate less aggressively: 2.4 M → 240 k → demod → resample to 48 k).
- **CW is a subset of USB/LSB** — reuse the SSB demod with a narrow post-filter. The "CW app" is mostly a UI/preset specialization.
- **RDS can be a sub-feature of WFM** or a standalone app. Implementing it as a standalone app with its own display keeps the architecture consistent (one app = one flowgraph). Internally it instantiates the WFM flowgraph + RDS decoder.
- **Frequency manager integration (future):** All voice apps will eventually share a frequency bookmarks panel. Not in Phase 1 scope.
