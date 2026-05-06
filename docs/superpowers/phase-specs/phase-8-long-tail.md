# Phase 8 — Long-Tail & Heterogeneous Apps

**Theme:** Remaining apps that don't fit cleanly into earlier phases. Each is relatively standalone — different protocols, different frequency bands, different DSP requirements. Grouped here because they have limited shared infrastructure and are best tackled after the core platform is mature.

**Shared building blocks:** Mostly reuse from earlier phases. Minimal new shared infrastructure — each app is its own mini-project.

---

## Apps

| # | App | Description | Category | Key Complexity |
|---|-----|-------------|----------|----------------|
| 1 | BTLE RX (Sniffer) | Sniff BLE advertisement + connection packets | 2.4 GHz RX | GFSK demod, BLE channel hopping, connection following |
| 2 | BTLE Comm | BLE communication (pair + exchange data) | 2.4 GHz TX/RX | Full BLE link layer state machine |
| 3 | NRF24 Sniffer | Sniff nRF24L01 Enhanced ShockBurst packets | 2.4 GHz RX | GFSK demod, address detection, auto-channel scan |
| 4 | Encoder Suite | Collection of signal encoders (Holtek, Princeton, etc.) | Sub-GHz TX | Multiple OOK protocol encoders |
| 5 | Decoder Suite | Collection of signal decoders (multi-protocol) | Sub-GHz RX | Multi-protocol simultaneous decode |
| 6 | Capture/Replay Manager | Advanced capture + tag + organize + selective replay | General | File management + metadata + selective TX |
| 7 | Spectrum Painter | Draw images on waterfall via shaped transmissions | TX Art | Image → frequency-time mapping → TX |
| 8 | RF Characterization | Measure filter responses, antenna SWR (with external hardware) | Test/Measurement | Sweep TX + measure RX response |
| 9 | Protocol Analyzer | Generic digital signal analysis (eye diagram, constellation, BER) | Analysis | Symbol timing recovery, constellation display |
| 10 | Remote Control | Control Mayhem PC instance over network | Networking | WebSocket/REST server, remote UI |
| 11 | IQ File Player | Play back IQ recordings through DSP pipeline (offline analysis) | File/Analysis | File source → any app's DSP chain |
| 12 | SDR Benchmark | Measure system performance (throughput, latency, drop rate) | Test | Synthetic load generation, metrics |
| 13 | Frequency Counter | Precision frequency measurement | Test/Measurement | FFT peak interpolation, gate time |
| 14 | CTCSS/DCS Decoder | Decode sub-audible tones and digital codes on FM signals | FM RX addon | Goertzel tone detect, DCS polynomial match |
| 15 | DMR RX | Digital Mobile Radio receiver (listen only) | Digital Voice | GFSK → TDMA → AMBE codec (or metadata only) |
| 16 | dPMR RX | Digital PMR receiver | Digital Voice | GFSK → dPMR framing → metadata |
| 17 | P25 RX | Project 25 Phase 1 receiver (listen only) | Digital Voice | C4FM → IMBE codec (or metadata only) |
| 18 | NXDN RX | NXDN digital voice receiver | Digital Voice | FSK → NXDN framing → AMBE |
| 19 | Tetra RX | TETRA digital trunked radio receiver | Digital Voice | π/4-DQPSK → TETRA framing → metadata |
| 20 | Pager Aggregator | Multi-protocol pager monitoring (POCSAG + FLEX + Golay) | RX | Parallel decode from single capture |

---

## Per-App Details

### 1. BTLE RX (Sniffer)
- **Signal:** 2.4 GHz ISM band, 40 channels (37/38/39 = advertising, 0-36 = data). GFSK 1 Mbps.
- **DSP:** HackRF @ 2.4 GHz → GFSK demod → BLE packet detect (access address match) → CRC check → PDU parse.
- **Challenge:** HackRF bandwidth covers ~20 MHz — can monitor several channels simultaneously. For connection sniffing, need to follow hop sequence (requires capturing connection parameters).
- **First slice:** Advertisement sniffing on channels 37/38/39 only.

### 2. BTLE Comm
- **Concept:** Act as a BLE Central or Peripheral — scan, connect, exchange GATT data.
- **Complexity:** VERY HIGH. Full BLE link layer: advertising → connection → channel hopping → L2CAP → ATT/GATT.
- **Reality check:** HackRF's timing precision may be insufficient for BLE's tight connection intervals (7.5 ms minimum). May need to limit to non-real-time analysis or extended intervals.
- **First slice:** Scan + display advertisement data. Connection is stretch.

### 3. NRF24 Sniffer
- **Signal:** 2.4 GHz, GFSK 250k/1M/2M bps. 126 channels (1 MHz spacing starting at 2400 MHz).
- **DSP:** GFSK demod → Enhanced ShockBurst frame detect (preamble + address) → payload extract.
- **Challenge:** Need to know or guess target address. "Promiscuous mode" sniffing uses common addresses or tries all.
- **First slice:** Listen on single channel with known address.

### 4. Encoder Suite
- **Concept:** Collection of OOK/FSK encoders for various simple protocols.
- **Protocols:** Holtek HT12E, Princeton PT2262/PT2272, EV1527, Came, NICE, Linear, SMC5326.
- **UI:** Protocol selector → parameter input (address, data bits) → preview pulse train → transmit.
- **Regulatory:** OwnDevicesOnly. User must own the device being controlled.
- **Implementation:** Data-driven protocol definitions (timing specs in TOML), shared OOK TX engine.

### 5. Decoder Suite
- **Concept:** Multi-protocol parallel decoder. Capture OOK signals and try all known decoders simultaneously.
- **Like:** rtl_433's multi-protocol approach.
- **Implementation:** OOK envelope → run through all registered protocol matchers → display decoded results.
- **First slice:** 5-10 most common protocols. Expand database over time.

### 6. Capture/Replay Manager
- **Enhancement over Phase 6's Replay TX:** Adds metadata tagging, search, selective replay of portions.
- **Features:** Record with auto-trigger, tag by protocol/device, trim, replay selection, export.
- **UI:** Waveform display with selection, metadata sidebar, search/filter.

### 7. Spectrum Painter
- **Concept:** Convert an image into frequency-time-power mapping, transmit as shaped noise visible on a waterfall display.
- **DSP:** Image pixels → FFT bin amplitudes → IFFT → time-domain IQ → HackRF sink.
- **Regulatory:** IndoorTestOnly (it's intentional wideband transmission).
- **Fun factor:** High. Visual confirmation: tune a receiver's waterfall and see your image.

### 8. RF Characterization
- **Concept:** Use HackRF TX + RX (or second HackRF) to measure filter/antenna responses.
- **Method:** Sweep TX across frequency range, measure received power at each step.
- **Limitation:** Requires either loopback cable or two HackRFs (one TX, one RX). Single HackRF can't TX and RX simultaneously.
- **First slice:** TX sweep only (measure with external equipment). Two-HackRF support is stretch.

### 9. Protocol Analyzer
- **Concept:** Generic digital signal analysis tools.
- **Features:** Eye diagram, constellation diagram, symbol timing recovery, BER measurement (against known pattern).
- **Input:** Live IQ or recorded file.
- **UI:** Eye/constellation plots, clock recovery visualization, metrics.

### 10. Remote Control
- **Concept:** Expose Mayhem PC's command interface over network for remote operation.
- **Implementation:** Embedded WebSocket or REST server. Remote client sends commands (tune, start app, etc.), receives events (spectrum, status).
- **Security:** Localhost only by default. Optional authentication for LAN access.
- **Use case:** Control a headless Mayhem PC instance from another machine or mobile device.

### 11. IQ File Player
- **Concept:** Replace HackRF source with a file source. Run any app's DSP pipeline on recorded data.
- **Use case:** Offline analysis, training, development without hardware.
- **Implementation:** Already partially exists (test harness uses file sources). Expose as a user-facing app with file browser and app-selector.

### 12–20. Remaining Apps
- **SDR Benchmark:** Synthetic load test — measure max throughput, latency percentiles, drop rates under load.
- **Frequency Counter:** High-precision frequency measurement via FFT peak interpolation or zero-crossing counting.
- **CTCSS/DCS Decoder:** Sub-audible tone detection. Goertzel filters for CTCSS (67–254.1 Hz), polynomial check for DCS.
- **Digital Voice RX (DMR, dPMR, P25, NXDN, Tetra):** These all follow a pattern: demod → framing → metadata extract. Full voice decode requires proprietary codecs (AMBE, IMBE) which are patent-encumbered. First slice: metadata only (talkgroup, source ID, call type). Voice via external vocoder (e.g., mbe_synthesizer) is a stretch.
- **Pager Aggregator:** Monitor paging frequencies, decode POCSAG + FLEX + Golay simultaneously from a wideband capture.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| BTLE RX | Adv channel sniff + PDU display | Connection following |
| BTLE Comm | Scan + display adverts | Connect + GATT read |
| NRF24 Sniffer | Single channel + known address | Promiscuous scan |
| Encoder Suite | PT2262 + EV1527 encoders | Full protocol database |
| Decoder Suite | 5 common OOK protocols | rtl_433-level coverage |
| Capture/Replay Manager | Record + tag + replay | Trim, search, export |
| Spectrum Painter | B&W image → TX → visible on waterfall | Color, animation |
| RF Characterization | TX sweep generator | Two-HackRF measurement |
| Protocol Analyzer | Eye diagram from IQ file | Live, constellation, BER |
| Remote Control | WebSocket command interface | Auth, mobile client |
| IQ File Player | File → NFM pipeline | File → any app |
| SDR Benchmark | Throughput + drop rate test | Latency histogram |
| Frequency Counter | FFT peak frequency display | Gate time, averaging |
| CTCSS/DCS Decoder | CTCSS tone detect (standalone) | Integrated into NFM app |
| DMR RX | GFSK → metadata (TG, source) | Voice (external codec) |
| dPMR RX | FSK → metadata | — |
| P25 RX | C4FM → metadata | Voice (IMBE) |
| NXDN RX | FSK → metadata | — |
| Tetra RX | DQPSK → metadata | — |
| Pager Aggregator | POCSAG + FLEX parallel decode | Golay, multi-frequency |

---

## Implementation Notes

- **Digital voice apps (DMR, P25, NXDN, Tetra, dPMR) share a challenge:** The audio codecs (AMBE2+, IMBE) are patent-protected. Options:
  - (a) Metadata-only decode (talkgroup, source ID, encryption flag) — legal and useful.
  - (b) Use open-source codec implementations (md380tools AMBE, OP25 IMBE) — legally grey.
  - (c) Support external vocoder hardware (DV Dongle, ThumbDV) via USB — clean but requires hardware.
  - **Recommendation:** Ship metadata-only as first slice. Voice support via external vocoder as opt-in stretch.
  
- **BTLE and NRF24 push HackRF's limits** at 2.4 GHz. The HackRF's sensitivity at 2.4 GHz is lower than at VHF/UHF. Range will be limited compared to dedicated BLE/NRF hardware.

- **This phase has the most apps (~20) but many are variations** on similar themes (digital voice family, OOK encoder/decoder collections). Group implementations where code can be shared.

- **Priority order suggestion:** IQ File Player (enables offline development), CTCSS/DCS (small, high value as NFM addon), Encoder/Decoder Suite (builds on Phase 3), BTLE RX (high demand), digital voice (community value), remaining utilities.

- **Some of these apps may be better as "features" of existing apps** rather than standalone:
  - CTCSS/DCS → addon to NFM RX.
  - IQ File Player → mode of every RX app.
  - Frequency Counter → feature of Signal Strength Meter (Phase 7).
  - The implementation plan should decide case-by-case whether each is standalone or integrated.
