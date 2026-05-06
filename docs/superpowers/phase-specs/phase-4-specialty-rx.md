# Phase 4 — Specialty Receivers

**Theme:** One-off receivers that each require their own DSP pipeline. These don't share a common demodulator family — each is essentially its own signal-processing project. Grouped here because they're all RX-only and have high standalone value.

**Shared building blocks (new in this phase):**
- APT line sync + image assembler — for NOAA weather satellite imagery.
- DSC (Digital Selective Calling) decoder — maritime distress/routine protocol.
- Sonde frame decoders (extended from Phase 2 if not fully covered there).
- Image rendering pipeline (pixel stream → progressive image display).

---

## Apps

| # | App | Description | Frequency / Protocol | Key UI Elements |
|---|-----|-------------|---------------------|-----------------|
| 1 | NOAA APT RX | Decode NOAA weather satellite imagery | 137 MHz, AM carrier → 2400 Hz subcarrier → APT line format | Progressive image display, pass scheduler, satellite selector |
| 2 | DSC RX | Digital Selective Calling decoder (maritime) | 2187.5 kHz (HF) or VHF Ch 70 (156.525 MHz), FSK 100 baud | Message table (MMSI, nature of distress, position), alert |
| 3 | EPIRB RX | Emergency Position Indicating Radio Beacon detector | 406 MHz, BPSK → BCH-protected message → hex ID + position | Beacon table (hex ID, country, position), alert sound |
| 4 | Radiosonde RX (extended) | Full multi-format sonde decoder | 400–406 MHz, various FSK formats | Telemetry, GPS track, ascent rate, burst detect, map |
| 5 | DAB RX (lite) | Digital Audio Broadcasting — metadata + basic decode | 174–240 MHz (Band III), OFDM/DQPSK → FIC decode | Ensemble list, service labels, program type (audio stretch) |
| 6 | NOAA HRPT RX | High-resolution satellite imagery (stretch) | 1698/1707 MHz, BPSK → CADU frames → image channels | Multi-channel image, calibration, map overlay |
| 7 | Meteor M2 LRPT RX | Russian weather satellite low-rate picture | 137.1/137.9 MHz, QPSK → Viterbi → Reed-Solomon → image | Progressive image (3 channels), pass scheduler |
| 8 | ADSB Extended (DF4/5/11/20/21) | Extended Mode S decode beyond DF17 | 1090 MHz (extends Phase 0 ADS-B) | Enhanced aircraft table, interrogator info |

---

## Per-App Details

### 1. NOAA APT RX
- **Signal:** 137.x MHz, ~40 kHz bandwidth. AM carrier with 2400 Hz subcarrier amplitude-modulated by pixel luminance.
- **DSP pipeline:** FM source → AM demod (envelope) → 2400 Hz bandpass → half-wave rectify → sync detect (sync A/B markers) → pixel assembly (2080 pixels/line, ~0.5 s/line).
- **Challenge:** Doppler shift during satellite pass (~±3 kHz). Compensate with AFC or manual retune.
- **UI:** Progressive line-by-line image. Two channels (A = visible, B = infrared). Pass prediction overlay (optional, from TLE data).

### 2. DSC RX
- **Signal:** 100 baud FSK (±85 Hz deviation) on dedicated maritime frequencies.
- **Protocol:** ITU-R M.493. 10-bit symbols (7 data + 3 error check). Format: dot pattern → phasing → category → MMSI → nature/position → EOS/ECC.
- **DSP:** FM demod → FSK slicer @ 100 baud → DSC frame decoder.
- **UI:** Message list with fields decoded (distress, urgency, safety, routine).

### 3. EPIRB RX
- **Signal:** 406.025 MHz, BPSK @ 400 bps. Short burst (~0.5 s message, repeated).
- **Protocol:** COSPAS-SARSAT. 144-bit message: sync (15 bits) + frame sync (9) + PDF-1 (61) + PDF-2 (26) + BCH parity.
- **DSP:** FM source → BPSK demod (carrier recovery + symbol timing) → frame sync correlator → BCH decode.
- **UI:** Beacon table. In a real scenario this would trigger alerts — we display only, no relay.

### 4. Radiosonde RX (extended)
- Extension of Phase 2's radiosonde decoder. Add:
  - M10/M20 (Modem) support.
  - DFM (Graw) support.
  - iMet support.
  - Burst detection + descent tracking.
- **Map integration:** Track on map with altitude color coding.

### 5. DAB RX (lite)
- **Signal:** OFDM with 1536 carriers, DQPSK modulation, 1.536 MHz bandwidth.
- **Scope (lite):** Decode FIC (Fast Information Channel) only — provides ensemble/service labels, program type, announcements. Full audio decode (MPEG/AAC) is a stretch goal.
- **DSP:** FFT-based OFDM demod → DQPSK → FIC assembly → FIG decode.
- **Challenge:** OFDM synchronization (time + frequency). Use the null symbol + phase reference for coarse sync.

### 6–8. Stretch Apps
- HRPT and Meteor LRPT are satellite imagery apps requiring precise symbol timing and FEC.
- ADS-B Extended adds more Mode S downlink formats to the existing Phase 0 decoder.
- These are high-effort, high-reward apps that may slip to a later phase if schedule requires.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| NOAA APT RX | AM demod → sync detect → grayscale image (1 channel) | Dual channel, color composite, AFC |
| DSC RX | FSK decode → raw symbol display → structured message | Alert categories, MMSI database lookup |
| EPIRB RX | BPSK demod → frame detect → hex ID extract | Position decode, beacon database |
| Radiosonde RX ext. | Add M10 + DFM (on top of Phase 2 RS41) | iMet, descent tracking |
| DAB RX (lite) | OFDM sync → FIC decode → ensemble/service list | Audio stream (AAC) |
| NOAA HRPT | BPSK demod → CADU frame sync → channel extract | Calibration, geo-projection |
| Meteor M2 LRPT | QPSK → Viterbi → RS → image assembly | Multi-channel composite |
| ADS-B Extended | Add DF11 (all-call), DF20/21 (BDS registers) | Enhanced surveillance data |

---

## Implementation Notes

- **NOAA APT is the most accessible** — strong signal, well-documented, many reference implementations. Good "first app" for this phase.
- **DAB is the most complex** — OFDM + convolutional coding + interleaving. The "lite" version (FIC only) avoids the audio codec complexity but still requires correct OFDM demod.
- **All apps in this phase are Passive (RX-only)** — no regulatory concerns beyond NOAA HRPT which operates at a frequency that might require a longer antenna.
- **Satellite apps benefit from pass prediction** — consider a shared utility that computes satellite visibility from TLE files. Not required for first slice but valuable UX improvement.
- **EPIRB RX is listen-only** — we decode and display, never relay or trigger SAR. This is explicitly permitted (the refused app is EPIRB *TX* — fake distress beacons).
