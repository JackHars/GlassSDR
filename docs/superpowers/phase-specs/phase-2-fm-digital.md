# Phase 2 — FM-Family Digital Protocols

**Theme:** Decode digital protocols that ride on FM-modulated carriers. All share a common pipeline: FM demod → symbol slicer → protocol-specific decoder. Heavy reuse of Phase 0's FM demodulator and Phase 1's audio pipeline where applicable.

**Shared building blocks (new in this phase):**
- AFSK demodulator (Bell 202: 1200/2200 Hz mark/space) — core of APRS/AX.25.
- AX.25 frame decoder (HDLC framing, bit-unstuffing, CRC-16/CCITT).
- NMEA sentence assembler — for AIS multi-sentence messages.
- FSK symbol slicer (configurable baud, mark/space frequencies) — generalized from AFSK.
- Manchester decoder — for ERT and weather station protocols.
- Sonde frame sync + Reed-Solomon decoder — for radiosonde telemetry.

---

## Apps

| # | App | Description | Protocol Layer | Key UI Elements |
|---|-----|-------------|----------------|-----------------|
| 1 | APRS RX | Decode APRS position/status packets | FM → AFSK 1200 → AX.25 → APRS payload parse | Packet list, map overlay (position reports), raw hex |
| 2 | AIS RX | Decode ship Automatic Identification System | FM @ 161.975/162.025 MHz → GMSK 9600 → HDLC → AIS msg types | Ship table (MMSI, name, position, course), map |
| 3 | ACARS RX | Aircraft Communications Addressing and Reporting | AM @ VHF → AFSK 2400/1200 → ACARS framing | Message list (flight, reg, text), aircraft table |
| 4 | ERT RX | Electric/Gas/Water meter reading (Itron ERT) | OOK/FSK @ 900 MHz → Manchester → ERT packet | Meter table (ID, type, consumption), signal strength |
| 5 | Weather Station RX | Decode ISM-band weather sensors (Oregon Scientific, Acurite, etc.) | OOK/FSK @ 433/915 MHz → pulse decode → sensor-specific | Sensor table (temp, humidity, wind, rain), history graph |
| 6 | Radiosonde RX | Decode weather balloon telemetry (RS41, M10, DFM) | FM @ 400–406 MHz → FSK → sonde frame decode | Telemetry table (alt, temp, humidity, GPS), ascent plot, map |
| 7 | AFSK RX (generic) | General AFSK decoder with configurable params | FM → AFSK (configurable) → raw bit output | Bitstream display, hex dump, configurable mark/space |
| 8 | Two-Tone Pager RX | Decode two-tone sequential paging (fire/EMS dispatch) | FM → tone detection (dual sequential tones) → alert | Tone pair list, timestamp, alert sound |
| 9 | POCSAG RX | Decode POCSAG pager messages (receive side) | FM → FSK slicer → POCSAG frame decode | Message list (RIC, function, text), signal quality |
| 10 | FLEX RX | Decode FLEX pager protocol | FM → 4-FSK → FLEX frame decode | Message list, phase/cycle info |

---

## Shared DSP Blocks

### 1. AFSK Demodulator (`afsk_demod.rs`)
- **Method:** Correlation (Goertzel) or PLL-based mark/space detection.
- **Params:** mark_hz, space_hz, baud_rate, sample_rate.
- **Output:** soft symbols (f32) or hard bits (bool).
- **Used by:** APRS, ACARS, generic AFSK.

### 2. AX.25 Decoder (`ax25_decode.rs` in mayhem-protocols)
- **Input:** bit stream from AFSK demod.
- **Steps:** Flag detect (0x7E), bit-unstuffing, address/control/PID parse, CRC-16 check.
- **Output:** `Ax25Frame { src, dst, payload, ... }`.
- **Used by:** APRS (with APRS payload parser on top).

### 3. GMSK Demodulator (`gmsk_demod.rs`)
- **Method:** Laurent decomposition or differential detection.
- **Params:** baud_rate (9600 for AIS), BT product (0.4 for AIS).
- **Used by:** AIS.

### 4. Manchester / Pulse-Distance Decoder (`manchester.rs`)
- **Input:** baseband envelope (after FM demod or OOK envelope detect).
- **Params:** symbol_rate, encoding variant (Manchester/differential/pulse-width).
- **Output:** decoded bits.
- **Used by:** ERT, weather stations.

### 5. Sonde Frame Decoder (`sonde_decode.rs` in mayhem-protocols)
- **Variants:** RS41 (Vaisala), M10 (Modem), DFM (Graw).
- **Steps:** Frame sync → descramble (RS41) → Reed-Solomon ECC → field extract.
- **Output:** `SondeFrame { serial, lat, lon, alt, temp, humidity, ... }`.

### 6. FSK Symbol Slicer (`fsk_slicer.rs`)
- Generalized version of the POCSAG slicer from Phase 0.
- **Params:** num_levels (2 or 4), baud_rate, deviation_hz.
- **Used by:** POCSAG RX, FLEX RX, generic FSK apps.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| APRS RX | AFSK demod → AX.25 → display raw packets | Map overlay, APRS-IS gateway |
| AIS RX | GMSK demod → HDLC → type 1/2/3 position reports, table | Full message set, map |
| ACARS RX | AFSK demod → ACARS frame → text display | Flight lookup, label decode |
| ERT RX | Manchester → known ERT packet formats (SCM, SCM+) | Multi-protocol (IDM, NetMeter) |
| Weather Station RX | Pulse decode → Oregon Scientific v2.1/v3 | Acurite, LaCrosse, history |
| Radiosonde RX | RS41 decode only (most common) | M10, DFM, map tracking |
| AFSK RX | Configurable demod + hex dump | Protocol auto-detect |
| Two-Tone Pager RX | Dual-tone detect + alerting | Tone database, logging |
| POCSAG RX | Reuse encoder's inverse + display | Multi-address filter |
| FLEX RX | 4-FSK slicer + FLEX Phase A decode | Full 4-phase decode |

---

## Implementation Notes

- **APRS and AIS are the highest-value apps** in this phase — both have large user communities and well-documented protocols.
- **AIS requires dual-channel** (161.975 + 162.025 MHz). Options: (a) wideband capture covering both, or (b) app parameter to select channel. Start with single-channel, stretch to dual.
- **ERT and Weather Station overlap with Phase 3 (OOK/sub-GHz)** in RF characteristics but are placed here because their protocol decoders are the primary value, not the OOK capture infrastructure.
- **POCSAG RX is the natural complement to Phase 0's POCSAG TX.** Reuse the protocol crate's structures in reverse (decode instead of encode). The BCH decoder is the syndrome-based inverse of the encoder.
- **FLEX is complex** (4-level FSK, interleaved phases, multiple speeds). Plan as a stretch/last-in-phase app.
