# Phase 6 — Dual-Use Specialty TX

**Theme:** Transmit apps with legitimate testing/research uses but elevated regulatory risk. All require RegulatoryClass enforcement (OwnDevicesOnly or IndoorTestOnly), stronger legal banners, and per-band lockout validation. These apps exist to test your own equipment or conduct authorized research — never to target others' systems.

**Shared building blocks (reused):**
- HackRF sink, arm/disarm, legal banner (Phase 0).
- FSK/GFSK modulators (Phase 0).
- OOK pulse generator (inverse of Phase 3's OOK analyzer).
- Signal generator waveforms (Phase 3).

**New shared building blocks:**
- Replay engine — load captured IQ file, retransmit at original or new frequency.
- Per-band frequency lockout — enforce that certain frequencies (commercial paging, ATC, emergency) are never transmitted on regardless of user input.
- BLE advertising frame builder — construct valid BLE advertisement PDUs.
- NRF24/ShockBurst frame builder — construct valid Enhanced ShockBurst packets.

---

## Apps

| # | App | Description | Regulatory Class | Key UI Elements |
|---|-----|-------------|-----------------|-----------------|
| 1 | ADS-B TX | Transmit test ADS-B messages (own aircraft test) | IndoorTestOnly | ICAO24, callsign, position, altitude, velocity fields |
| 2 | GPS Simulator | Generate GPS L1 C/A signals (own device testing) | IndoorTestOnly | Lat/lon/alt input, time, satellite constellation selector |
| 3 | MDC1200 TX | Encode MDC-1200 signaling (radio ID/PTT-ID testing) | OwnDevicesOnly | Unit ID, opcode (PTT-ID, emergency, stun, etc.) |
| 4 | Replay TX | Retransmit captured IQ recordings | OwnDevicesOnly | File browser, frequency override, gain, single/loop |
| 5 | OOK Editor TX | Construct and transmit OOK pulse sequences | OwnDevicesOnly | Pulse timeline editor, protocol templates, frequency |
| 6 | Frequency Hopper | Transmit across frequency sequence (spread spectrum test) | IndoorTestOnly | Hop sequence editor, dwell time, pattern (linear/random) |
| 7 | BTLE TX | Transmit BLE advertisement frames | OwnDevicesOnly | PDU type, payload builder, channel (37/38/39), interval |
| 8 | NRF24 TX | Transmit nRF24L01 Enhanced ShockBurst packets | OwnDevicesOnly | Address, payload hex, channel, data rate (250k/1M/2M) |
| 9 | RFM69 TX | Transmit RFM69-compatible FSK packets | OwnDevicesOnly | Node/network ID, payload, frequency, bitrate, deviation |
| 10 | Flipper TX | Transmit Flipper Zero .sub file format captures | OwnDevicesOnly | File loader (.sub), frequency, protocol display |
| 11 | Keyfob Test TX | Transmit fixed-code keyfob patterns (your own remotes) | OwnDevicesOnly | Protocol (PT2262, EV1527), code bits, frequency, repeat |
| 12 | LGE TX | LGE protocol transmitter (appliance test) | OwnDevicesOnly | Command builder, device address, payload |

---

## Per-App Details

### 1. ADS-B TX
- **Purpose:** Test your own ADS-B receivers. Transmit known position reports and verify decode.
- **Protocol:** Mode S Extended Squitter (DF17). Encode TC9-18 (position), TC19 (velocity), TC1-4 (ident).
- **Safety:** IndoorTestOnly. Frequency locked to 1090 MHz (cannot be changed). Legal banner emphasizes: "INDOOR ONLY. Transmitting ADS-B on-air is a federal crime (49 USC §46316)."
- **DSP:** Codeword → PPM symbols → OOK modulate (2 Msps) → HackRF sink.
- **Validation:** Decode own transmission with Phase 0's ADS-B RX on a second HackRF or RTL-SDR.

### 2. GPS Simulator
- **Purpose:** Test GPS receivers with synthetic signals (own devices, RF-shielded).
- **Protocol:** GPS L1 C/A (1575.42 MHz). Generate PRN codes × navigation data × Doppler for visible satellites.
- **Safety:** IndoorTestOnly. Strongest possible legal banner. Frequency locked to L1.
- **Complexity:** HIGH. Requires GPS signal model: satellite orbits (almanac/ephemeris), PRN code generation (Gold codes), navigation message framing (50 bps), Doppler simulation.
- **Reference:** gps-sdr-sim (open source C implementation).

### 3. MDC1200 TX
- **Protocol:** MDC-1200: 1200 baud AFSK (1200/1800 Hz) data burst encoding unit ID + opcode.
- **Use case:** Test radio ID systems on your own equipment.
- **DSP:** MDC frame → AFSK modulate → FM → HackRF sink.

### 4. Replay TX
- **Concept:** Load a previously-captured IQ file (`.cs8`, `.cu8`, `.cf32`, `.wav`) and retransmit.
- **Use case:** Replay your own captured signals for testing decoders/receivers.
- **DSP:** File read → optional resampling → optional frequency shift → HackRF sink.
- **Safety:** User must attest they captured the signal themselves. Frequency can be overridden from original.

### 5. OOK Editor TX
- **Concept:** Visual pulse editor. Define pulse timing, preview, transmit.
- **Use case:** Test your own OOK devices (garage doors, sensors) or prototype new protocols.
- **UI:** Timeline with draggable pulses, import from Phase 3 captures, protocol templates.
- **DSP:** Pulse sequence → OOK baseband (on/off) → HackRF sink.

### 6. Frequency Hopper
- **Concept:** Transmit a carrier/signal that hops across frequencies on a schedule.
- **Use case:** Test spread-spectrum receivers, frequency-agile systems.
- **Safety:** IndoorTestOnly. Must not hop onto protected frequencies.
- **DSP:** Retune HackRF per hop step. Configurable dwell time, hop pattern, signal type per hop.

### 7–12. ISM/IoT Protocol Transmitters
- **Common pattern:** Build protocol-correct frames, modulate appropriately, transmit.
- **BTLE TX:** BLE adv PDU (37/38/39 channels at 2402/2426/2480 MHz). GFSK 1 Mbps, ±250 kHz deviation.
- **NRF24 TX:** Enhanced ShockBurst frame (preamble + address + PCF + payload + CRC). GFSK at 250k/1M/2M bps on 2.4 GHz ISM.
- **RFM69 TX:** FSK packet matching RFM69 radio module format. Configurable bitrate/deviation/sync word.
- **Flipper TX:** Parse `.sub` file (protocol, frequency, raw data) → regenerate and transmit.
- **Keyfob Test TX:** Fixed-code protocols (PT2262, EV1527). User provides code bits; app transmits.
- **LGE TX:** LGE appliance control protocol. Specific command encoding.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| ADS-B TX | Encode + transmit single position report | Continuous track simulation |
| GPS Simulator | Single satellite PRN, static position | Multi-satellite, moving receiver |
| MDC1200 TX | PTT-ID burst (unit ID only) | All opcodes (emergency, stun, revive) |
| Replay TX | Load .cu8 + transmit at original freq | Resample, freq shift, loop, trim |
| OOK Editor TX | Manual pulse entry + transmit | Visual editor, import from captures |
| Frequency Hopper | Linear hop across range | Random, ping-pong, dwell variation |
| BTLE TX | Single advertisement PDU on ch37 | All channels, scan response, interval |
| NRF24 TX | Fixed packet, 1 Mbps | ACK mode, pipe addressing |
| RFM69 TX | Basic packet TX | Variable-length, AES (if key provided) |
| Flipper TX | Parse + replay .sub files | Protocol-aware editing |
| Keyfob Test TX | PT2262 fixed code TX | EV1527, multi-button |
| LGE TX | Basic command frame | Full command set |

---

## Implementation Notes

- **RegulatoryClass enforcement is critical** in this phase. Every app here requires either `OwnDevicesOnly` or `IndoorTestOnly`. The legal banner must be mode-specific and cannot be dismissed with a generic acknowledgment.
- **Per-band lockout:** Implement a `FrequencyPolicy` that maintains a deny-list of protected bands (ATC, emergency, commercial paging, cellular). TX commands are rejected if the requested frequency falls in a denied band. This is defense-in-depth — the legal banner is primary, lockout is secondary.
- **ADS-B TX and GPS Simulator are the highest-risk apps.** Both have legitimate test uses but could cause serious harm if transmitted on-air. UI should make the "indoor only / dummy load" requirement unmissable (e.g., red background, persistent warning text).
- **Replay TX is the most general** — any signal that was captured can be replayed. This makes it powerful for testing but also the most likely to be misused. The "own signal" attestation is a social control, not a technical one.
- **The 12 refused apps are NOT in this list.** Specifically excluded: jammer, blespam, cvs_spam, same_tx, p25_tx, epirb_tx, two_tone_pager TX, ookbrute, keeloqtx, touchtunes, shoppingcart_lock, adult_toys_controller. These will never be implemented.
- **Testing strategy:** Each TX app validated by decoding with its corresponding RX app or an external tool. ADS-B TX → dump1090. GPS Sim → GPS receiver in RF-shielded box. BTLE TX → nRF sniffer. Replay → original decoder.
