# Phase 5 — Amateur TX Expansion

**Theme:** Transmit modes that require an amateur radio license. All reuse Phase 0's HackRF sink + arm/disarm + legal banner infrastructure. Each app encodes a different digital or analog format and feeds IQ samples to the sink.

**Shared building blocks (reused from earlier phases):**
- HackRF sink (Phase 0, Plan 3).
- Gaussian FSK modulator (Phase 0) — reused for AFSK TX, RTTY TX.
- RegulatoryClass::AmateurOnly enforcement + arm/disarm flow (Phase 0).
- Signal generator waveforms (Phase 3) — reused for tone generation in soundboard/morse.

**New shared building blocks:**
- AFSK modulator (Bell 202 / configurable) — generates mark/space audio tones, then FM-modulates.
- Baudot/ITA2 encoder — for RTTY.
- SSTV line encoder (Robot, Martin, Scottie modes) — pixel row → frequency-shift tones.
- Morse keyer — text → dit/dah timing → CW tone.
- Audio-to-FM upconverter — takes PCM audio and FM-modulates onto carrier (for soundboard).

---

## Apps

| # | App | Description | Modulation | Key UI Elements |
|---|-----|-------------|-----------|-----------------|
| 1 | RTTY TX | Radioteletype transmitter | AFSK (170 Hz shift, 45.45 baud) or direct FSK | Text input, baud/shift selector, TX indicator |
| 2 | SSTV TX | Slow-Scan Television transmitter | Frequency-shift audio tones → FM carrier | Image selector/capture, mode (Robot36, Martin1, Scottie1), progress bar |
| 3 | AFSK TX | Generic AFSK transmitter (AX.25/APRS capable) | AFSK 1200/2200 Hz → FM | Packet builder (APRS format), raw byte input, PTT |
| 4 | Morse TX | CW transmitter | On/off keying (CW) at configurable pitch | Text input, WPM slider, sidetone preview, Farnsworth spacing |
| 5 | Soundboard TX | Play audio clips over FM | PCM → FM modulate → HackRF sink | Clip grid (configurable), record button, frequency set |
| 6 | FLEX TX | FLEX pager transmitter | 2/4-FSK (1600/3200/6400 baud) | Address, message, phase/speed select |

---

## Per-App Details

### 1. RTTY TX
- **Protocol:** Baudot/ITA2 5-bit code. Start bit (space), 5 data bits, 1–1.5 stop bits (mark).
- **Modulation:** FSK with configurable shift (170 Hz standard, 850 Hz wide). Direct FSK via HackRF or AFSK into FM.
- **Baud rates:** 45.45 (standard), 50, 75, 100.
- **DSP pipeline:** Text → Baudot encoder (with LTRS/FIGS shifts) → NRZ bits → FSK modulator → HackRF sink.

### 2. SSTV TX
- **Protocol:** Analog SSTV — each pixel row encoded as frequency variations (1500–2300 Hz = black to white, 1200 Hz sync pulse).
- **Modes:** Robot 36/72, Martin M1/M2, Scottie S1/S2. Each defines line timing, color encoding (RGB or Y/C), sync structure.
- **DSP pipeline:** Image (resize to mode resolution) → pixel → frequency mapping → tone generation (DDS) → FM modulate → HackRF sink.
- **UI:** Load image, preview at target resolution, select mode, transmit with progress.

### 3. AFSK TX
- **Primary use case:** APRS beacon transmission on 144.390 MHz (North America) or 144.800 MHz (Europe).
- **Protocol:** AX.25 frame (address + control + PID + payload + FCS) → NRZI encoding → AFSK 1200 baud (1200/2200 Hz).
- **DSP pipeline:** Packet bytes → AX.25 framing (with bit-stuffing) → NRZI → AFSK modulator → FM → HackRF sink.
- **UI:** APRS position/status message builder, or raw packet hex input.

### 4. Morse TX
- **Encoding:** ITU Morse code. Dit = 1 unit, dah = 3 units, inter-element = 1 unit, inter-character = 3 units, inter-word = 7 units.
- **Unit duration:** 1200 ms / WPM.
- **Modulation:** CW = carrier on/off. Generate continuous tone during key-down, silence during key-up. Shape with raised-cosine edges to avoid key clicks.
- **DSP pipeline:** Text → morse timing → on/off envelope → CW tone gen → HackRF sink.
- **UI:** Text input, WPM (5–50), sidetone audio preview (local), TX frequency.

### 5. Soundboard TX
- **Concept:** User loads audio clips (WAV/MP3), app FM-modulates them onto a carrier and transmits.
- **Use case:** Amateur radio "sound effects" or automated voice ID.
- **DSP pipeline:** PCM audio (resample to 48 kHz if needed) → pre-emphasis → FM modulator (±5 kHz NFM or ±75 kHz WFM) → HackRF sink.
- **UI:** Grid of clip buttons (drag-and-drop to load), frequency input, deviation selector (NFM/WFM).

### 6. FLEX TX
- **Protocol:** Motorola FLEX. Complex multi-phase protocol: 1600/3200/6400 baud, 2-FSK or 4-FSK.
- **Structure:** Sync (1600 baud always) → FIW (Frame Info Word) → data phases (A, B, C, D at selected speed).
- **Complexity:** Highest in this phase. Interleaving, BCH+CRC protection, multiple address/message types.
- **DSP pipeline:** Message → FLEX frame encoder → 2/4-FSK modulator → HackRF sink.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| RTTY TX | Baudot encoder + 170 Hz FSK @ 45.45 baud | Configurable shift/baud, diddle (LTRS idle) |
| SSTV TX | Robot 36 mode only (simplest timing) | Martin/Scottie, camera capture |
| AFSK TX | Raw AX.25 packet TX at 1200 baud | APRS message builder UI |
| Morse TX | Text → CW keying, fixed WPM | Farnsworth, paddle mode, decoder feedback |
| Soundboard TX | Single clip FM TX | Multi-clip grid, record |
| FLEX TX | 1600 baud 2-FSK, single-phase (A only) | Full 4-phase, 6400 baud |

---

## Implementation Notes

- **All apps in this phase are RegulatoryClass::AmateurOnly.** They reuse the arm/disarm + legal banner infrastructure from Plan 3 (POCSAG TX). No new regulatory UI needed.
- **RTTY and Morse are the simplest** — well-suited to implement first in this phase. Both are essentially "text → timing → tone → FM/CW."
- **SSTV TX has the most "wow factor"** — transmitting images over radio is visually compelling. Reference implementations: MMSSTV (Windows), PySSTV (Python).
- **AFSK TX enables APRS** — high amateur community value. Requires correct AX.25 framing (bit-stuffing, CRC-16) which was partially built in Phase 2's RX side.
- **FLEX TX is the hardest** — Motorola's protocol is complex and poorly publicly documented. Consider implementing only basic single-phase as a stretch goal.
- **Testing:** Each TX app can be validated by transmitting into a dummy load and decoding with the corresponding RX app or external tool (fldigi for RTTY/CW, MMSSTV for SSTV, direwolf for AFSK/APRS).
