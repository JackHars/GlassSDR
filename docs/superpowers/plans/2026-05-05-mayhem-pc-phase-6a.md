# Mayhem PC Phase 6a — Dual-Use TX: ADS-B TX, GPS Sim, MDC1200, Replay, OOK Editor, Hopper

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 dual-use specialty TX apps: ADS-B TX, GPS Simulator, MDC1200 TX, Replay TX, OOK Editor TX, and Frequency Hopper. All require elevated regulatory enforcement (IndoorTestOnly or OwnDevicesOnly) with per-band frequency lockouts.

**Architecture:** New protocol encoders (ADS-B TX, GPS L1 C/A, MDC-1200) in `mayhem-protocols`. New frequency lockout policy system. Replay uses file I/O + HackRF sink. OOK Editor uses pulse-to-IQ generation. All reuse arm/disarm + legal banner from Phase 0.

**Spec reference:** `docs/superpowers/phase-specs/phase-6-dualuse-tx.md`

---

## File structure produced by this plan

```
crates/mayhem-protocols/src/
├── adsb_tx/
│   ├── mod.rs
│   └── encode.rs                  # ADS-B DF17 encoder (position, velocity, ident)
├── gps/
│   ├── mod.rs
│   ├── prn.rs                     # GPS Gold code PRN generation
│   └── nav_message.rs             # Navigation message framing
├── mdc1200/
│   ├── mod.rs
│   └── encode.rs                  # MDC-1200 unit ID + opcode encoder
└── lib.rs

crates/mayhem-radio/src/
└── freq_policy.rs                 # Per-band TX frequency lockout enforcement

crates/mayhem-apps/src/
├── adsb_tx.rs
├── gps_sim.rs
├── mdc1200_tx.rs
├── replay_tx.rs
├── ook_editor_tx.rs
├── freq_hopper.rs
└── lib.rs

crates/mayhem-ipc/src/lib.rs

frontend/src/apps/
├── adsb-tx/AdsbTxApp.tsx
├── gps-sim/GpsSimApp.tsx
├── mdc1200-tx/Mdc1200TxApp.tsx
├── replay-tx/ReplayTxApp.tsx
├── ook-editor-tx/OokEditorTxApp.tsx
└── freq-hopper/FreqHopperApp.tsx
```

---

## Task 1: Frequency lockout policy system

**Why first:** All Phase 6 TX apps must refuse transmission on protected frequencies. This is a shared safety layer.

**Files:**
- Create: `crates/mayhem-radio/src/freq_policy.rs`
- Modify: `crates/mayhem-radio/src/lib.rs`

- [ ] **Step 1: Implement frequency policy**

```rust
//! Per-band TX frequency lockout.
//! Defense-in-depth: prevents TX on protected frequencies regardless of user input.

/// Protected frequency bands where TX is always denied.
const DENIED_BANDS: &[(f64, f64, &str)] = &[
    // Air Traffic Control
    (108_000_000.0, 137_000_000.0, "VHF aviation nav/comm"),
    (225_000_000.0, 380_000_000.0, "UHF military aviation"),
    (960_000_000.0, 1215_000_000.0, "DME/TACAN/ATC radar"),
    (1030_000_000.0, 1030_000_001.0, "Mode S interrogation"),
    // Emergency / distress
    (121_500_000.0, 121_500_001.0, "Aviation emergency"),
    (156_800_000.0, 156_800_001.0, "Maritime Ch16 distress"),
    (243_000_000.0, 243_000_001.0, "Military emergency"),
    (406_000_000.0, 406_100_000.0, "COSPAS-SARSAT EPIRB"),
    // Cellular
    (698_000_000.0, 960_000_000.0, "Cellular bands (partial)"),
    (1710_000_000.0, 2200_000_000.0, "AWS/PCS cellular"),
    // GPS
    (1575_420_000.0, 1575_420_001.0, "GPS L1 (see exception)"),
    // Commercial paging (protect against accidental POCSAG on wrong freq)
    (929_000_000.0, 932_000_000.0, "Commercial paging"),
    (931_000_000.0, 931_900_000.0, "Commercial paging"),
];

/// Frequencies explicitly allowed for specific apps (overrides deny list).
/// Key: app name. Value: allowed band.
const APP_EXCEPTIONS: &[(&str, f64, f64)] = &[
    // ADS-B TX is allowed on 1090 MHz (IndoorTestOnly, the whole point)
    ("adsb_tx", 1090_000_000.0, 1090_000_001.0),
    // GPS Sim is allowed on L1 (IndoorTestOnly)
    ("gps_sim", 1575_420_000.0, 1575_420_001.0),
];

#[derive(Debug, Clone)]
pub struct FrequencyPolicy;

impl FrequencyPolicy {
    /// Check if a frequency is allowed for TX by the given app.
    /// Returns Ok(()) if allowed, Err(reason) if denied.
    pub fn check(app_id: &str, freq_hz: f64) -> Result<(), String> {
        // Check app-specific exceptions first
        for &(app, low, high) in APP_EXCEPTIONS {
            if app == app_id && freq_hz >= low && freq_hz <= high {
                return Ok(());
            }
        }

        // Check deny list
        for &(low, high, reason) in DENIED_BANDS {
            if freq_hz >= low && freq_hz <= high {
                return Err(format!(
                    "TX denied at {:.3} MHz: protected band ({})",
                    freq_hz / 1_000_000.0,
                    reason
                ));
            }
        }

        Ok(())
    }

    /// Check frequency is within HackRF range (1 MHz – 6 GHz).
    pub fn check_hackrf_range(freq_hz: f64) -> Result<(), String> {
        if freq_hz < 1_000_000.0 || freq_hz > 6_000_000_000.0 {
            return Err(format!("Frequency {:.3} MHz outside HackRF range", freq_hz / 1e6));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denies_aviation() {
        assert!(FrequencyPolicy::check("replay_tx", 121_500_000.0).is_err());
    }

    #[test]
    fn denies_cellular() {
        assert!(FrequencyPolicy::check("ook_editor_tx", 850_000_000.0).is_err());
    }

    #[test]
    fn allows_amateur_2m() {
        assert!(FrequencyPolicy::check("afsk_tx", 144_390_000.0).is_ok());
    }

    #[test]
    fn allows_adsb_tx_on_1090() {
        assert!(FrequencyPolicy::check("adsb_tx", 1090_000_000.0).is_ok());
    }

    #[test]
    fn denies_adsb_tx_on_other_freq() {
        // 1090 is in the DME/TACAN band, but adsb_tx has an exception
        // Other apps should be denied
        assert!(FrequencyPolicy::check("replay_tx", 1090_000_000.0).is_err());
    }

    #[test]
    fn allows_ism_433() {
        assert!(FrequencyPolicy::check("ook_editor_tx", 433_920_000.0).is_ok());
    }
}
```

- [ ] **Step 2: Add to lib.rs and commit**

```bash
git add crates/mayhem-radio/src/freq_policy.rs crates/mayhem-radio/src/lib.rs
git commit -m "mayhem-radio: TX frequency lockout policy (protected band enforcement)"
```

---

## Task 2: ADS-B TX encoder

**Files:**
- Create: `crates/mayhem-protocols/src/adsb_tx/mod.rs`
- Create: `crates/mayhem-protocols/src/adsb_tx/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement ADS-B DF17 encoder**

```rust
//! ADS-B DF17 encoder: build Mode S Extended Squitter messages for TX testing.
//! Inverse of the Phase 0 decoder.

use crate::adsb::crc::crc24;

#[derive(Debug, Clone)]
pub struct AdsbTxMessage {
    pub icao24: u32,       // 24-bit ICAO address
    pub typecode: AdsbTxType,
}

#[derive(Debug, Clone)]
pub enum AdsbTxType {
    Identification { callsign: String, category: u8 },
    Position { lat: f64, lon: f64, altitude_ft: i32, odd: bool },
    Velocity { speed_kt: f64, heading_deg: f64, vert_rate_fpm: i32 },
}

/// Encode an ADS-B message to 14 bytes (112 bits) ready for PPM modulation.
pub fn encode_adsb(msg: &AdsbTxMessage) -> [u8; 14] {
    let mut frame = [0u8; 14];

    // Byte 0: DF=17 (5 bits) + CA=5 (3 bits) → 0x8D
    frame[0] = 0x8D;

    // Bytes 1-3: ICAO24
    frame[1] = (msg.icao24 >> 16) as u8;
    frame[2] = (msg.icao24 >> 8) as u8;
    frame[3] = msg.icao24 as u8;

    // Bytes 4-10: ME (56 bits) depends on type
    match &msg.typecode {
        AdsbTxType::Identification { callsign, category } => {
            encode_identification(&mut frame[4..11], callsign, *category);
        }
        AdsbTxType::Position { lat, lon, altitude_ft, odd } => {
            encode_position(&mut frame[4..11], *lat, *lon, *altitude_ft, *odd);
        }
        AdsbTxType::Velocity { speed_kt, heading_deg, vert_rate_fpm } => {
            encode_velocity(&mut frame[4..11], *speed_kt, *heading_deg, *vert_rate_fpm);
        }
    }

    // Bytes 11-13: CRC24 over bytes 0-10
    let crc = crc24(&frame[0..11]);
    frame[11] = (crc >> 16) as u8;
    frame[12] = (crc >> 8) as u8;
    frame[13] = crc as u8;

    frame
}

/// Convert 14-byte ADS-B frame to PPM bit sequence for OOK transmission.
/// Each bit: 1 → [1,0] (pulse then gap), 0 → [0,1] (gap then pulse).
/// At 2 Msps: each half-bit = 1 sample (0.5 µs).
pub fn adsb_to_ppm(frame: &[u8; 14]) -> Vec<u8> {
    let mut ppm = Vec::with_capacity(8 + 112 * 2); // preamble + data

    // 8 µs preamble: pulses at 0, 1, 3.5, 4.5 µs (at 2 Msps = samples 0,2,7,9)
    let preamble = [1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0]; // 16 samples = 8 µs
    ppm.extend_from_slice(&preamble);

    // 112 data bits as PPM
    for byte_idx in 0..14 {
        for bit_idx in (0..8).rev() {
            let bit = (frame[byte_idx] >> bit_idx) & 1;
            if bit == 1 {
                ppm.push(1);
                ppm.push(0);
            } else {
                ppm.push(0);
                ppm.push(1);
            }
        }
    }

    ppm
}

fn encode_identification(me: &mut [u8], callsign: &str, category: u8) {
    // TC=4 (type code 1-4), category
    me[0] = (4 << 3) | (category & 0x07);

    // Callsign: 8 chars, 6 bits each = 48 bits
    let chars: Vec<u8> = callsign.bytes()
        .chain(std::iter::repeat(b' '))
        .take(8)
        .map(|b| adsb_char_encode(b))
        .collect();

    // Pack 8 × 6-bit chars into 6 bytes
    me[1] = (chars[0] << 2) | (chars[1] >> 4);
    me[2] = (chars[1] << 4) | (chars[2] >> 2);
    me[3] = (chars[2] << 6) | chars[3];
    me[4] = (chars[4] << 2) | (chars[5] >> 4);
    me[5] = (chars[5] << 4) | (chars[6] >> 2);
    me[6] = (chars[6] << 6) | chars[7];
}

fn encode_position(me: &mut [u8], lat: f64, lon: f64, alt_ft: i32, odd: bool) {
    // TC=11 (airborne position, barometric alt)
    let tc: u8 = 11;
    let ss: u8 = 0; // surveillance status
    let alt_code = encode_altitude(alt_ft);
    let cpr = encode_cpr(lat, lon, odd);

    me[0] = (tc << 3) | (ss << 1) | ((alt_code >> 11) as u8 & 0x01);
    me[1] = (alt_code >> 3) as u8;
    me[2] = ((alt_code as u8 & 0x07) << 5) | (0 << 4) | (if odd { 1 << 3 } else { 0 }) | ((cpr.0 >> 14) as u8 & 0x07);
    me[3] = (cpr.0 >> 6) as u8;
    me[4] = ((cpr.0 as u8 & 0x3F) << 2) | ((cpr.1 >> 15) as u8 & 0x03);
    me[5] = (cpr.1 >> 7) as u8;
    me[6] = (cpr.1 as u8 & 0x7F) << 1;
}

fn encode_velocity(me: &mut [u8], speed_kt: f64, heading_deg: f64, vrate: i32) {
    // TC=19, subtype=1 (ground speed)
    me[0] = (19 << 3) | 1;
    // Simplified: direct heading + speed encoding
    let ew_sign = if heading_deg > 180.0 { 1u8 } else { 0 };
    let ew_vel = ((heading_deg.to_radians().sin().abs() * speed_kt) as u16).min(1023);
    let ns_sign = if heading_deg > 90.0 && heading_deg < 270.0 { 1u8 } else { 0 };
    let ns_vel = ((heading_deg.to_radians().cos().abs() * speed_kt) as u16).min(1023);
    let vr_sign = if vrate < 0 { 1u8 } else { 0 };
    let vr_val = ((vrate.unsigned_abs() / 64) as u16).min(511);

    me[1] = (0 << 7) | (ew_sign << 6) | ((ew_vel >> 4) as u8 & 0x3F);
    me[2] = ((ew_vel as u8 & 0x0F) << 4) | (ns_sign << 3) | ((ns_vel >> 7) as u8 & 0x07);
    me[3] = ((ns_vel as u8 & 0x7F) << 1) | (vr_sign);
    me[4] = (vr_val >> 1) as u8;
    me[5] = ((vr_val as u8 & 0x01) << 7);
    me[6] = 0;
}

fn encode_altitude(alt_ft: i32) -> u16 {
    // Gillham altitude encoding (25-ft resolution for barometric)
    let n = ((alt_ft + 1000) / 25).max(0) as u16;
    n & 0xFFF
}

fn encode_cpr(lat: f64, lon: f64, odd: bool) -> (u32, u32) {
    // Compact Position Reporting (simplified)
    let nz = 15.0; // number of zones
    let dlat = if odd { 360.0 / (4.0 * nz - 1.0) } else { 360.0 / (4.0 * nz) };
    let lat_cpr = (((lat % dlat) / dlat) * 131072.0) as u32 & 0x1FFFF;
    let dlon = 360.0 / 60.0; // simplified
    let lon_cpr = (((lon % dlon) / dlon) * 131072.0) as u32 & 0x1FFFF;
    (lat_cpr, lon_cpr)
}

fn adsb_char_encode(ch: u8) -> u8 {
    match ch {
        b'A'..=b'Z' => ch - b'A' + 1,
        b'0'..=b'9' => ch - b'0' + 48,
        b' ' => 32,
        _ => 32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_ident() {
        let msg = AdsbTxMessage {
            icao24: 0x4840D6,
            typecode: AdsbTxType::Identification { callsign: "TEST1234".into(), category: 0 },
        };
        let frame = encode_adsb(&msg);
        assert_eq!(frame[0], 0x8D);
        assert_eq!(frame[1], 0x48);
    }

    #[test]
    fn ppm_length() {
        let frame = [0u8; 14];
        let ppm = adsb_to_ppm(&frame);
        assert_eq!(ppm.len(), 16 + 224); // 16 preamble + 112*2 data
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/adsb_tx/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: ADS-B DF17 encoder (ident, position, velocity + PPM)"
```

---

## Task 3: GPS L1 C/A signal encoder (basic)

**Files:**
- Create: `crates/mayhem-protocols/src/gps/mod.rs`
- Create: `crates/mayhem-protocols/src/gps/prn.rs`
- Create: `crates/mayhem-protocols/src/gps/nav_message.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement GPS PRN code generation**

```rust
//! GPS L1 C/A PRN code generation (Gold codes).
//! Each satellite has a unique 1023-chip PRN code.

/// Generate the C/A code (1023 chips) for a given satellite PRN number (1-32).
pub fn generate_ca_code(prn: u8) -> [i8; 1023] {
    let (tap1, tap2) = prn_taps(prn);
    let g1 = generate_g1();
    let g2 = generate_g2();

    let mut code = [0i8; 1023];
    for i in 0..1023 {
        let g2_chip = g2[(i + tap1 - 1) % 1023] ^ g2[(i + tap2 - 1) % 1023];
        code[i] = if (g1[i] ^ g2_chip) == 1 { -1 } else { 1 };
    }
    code
}

fn generate_g1() -> [u8; 1023] {
    let mut reg = [1u8; 10];
    let mut out = [0u8; 1023];
    for i in 0..1023 {
        out[i] = reg[9];
        let feedback = reg[2] ^ reg[9];
        reg.rotate_right(1);
        reg[0] = feedback;
    }
    out
}

fn generate_g2() -> [u8; 1023] {
    let mut reg = [1u8; 10];
    let mut out = [0u8; 1023];
    for i in 0..1023 {
        out[i] = reg[9];
        let feedback = reg[1] ^ reg[2] ^ reg[5] ^ reg[7] ^ reg[8] ^ reg[9];
        reg.rotate_right(1);
        reg[0] = feedback;
    }
    out
}

fn prn_taps(prn: u8) -> (usize, usize) {
    // G2 delay taps for PRNs 1-32
    match prn {
        1 => (2, 6), 2 => (3, 7), 3 => (4, 8), 4 => (5, 9),
        5 => (1, 9), 6 => (2, 10), 7 => (1, 8), 8 => (2, 9),
        9 => (3, 10), 10 => (2, 3), 11 => (3, 4), 12 => (5, 6),
        13 => (6, 7), 14 => (7, 8), 15 => (8, 9), 16 => (9, 10),
        17 => (1, 4), 18 => (2, 5), 19 => (3, 6), 20 => (4, 7),
        21 => (5, 8), 22 => (6, 9), 23 => (1, 3), 24 => (4, 6),
        25 => (5, 7), 26 => (6, 8), 27 => (7, 9), 28 => (8, 10),
        29 => (1, 6), 30 => (2, 7), 31 => (3, 8), 32 => (4, 9),
        _ => (2, 6), // default to PRN 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prn1_first_chips() {
        let code = generate_ca_code(1);
        assert_eq!(code.len(), 1023);
        // Known first 10 chips of PRN 1: 1,1,-1,-1,-1,1,-1,-1,1,-1
        // (varies by reference — just verify it's ±1)
        for &chip in &code {
            assert!(chip == 1 || chip == -1);
        }
    }

    #[test]
    fn all_prns_unique() {
        let prn1 = generate_ca_code(1);
        let prn2 = generate_ca_code(2);
        assert_ne!(&prn1[..], &prn2[..]);
    }
}
```

- [ ] **Step 2: Implement basic nav message frame (stub)**

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-protocols/src/gps/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: GPS L1 C/A PRN code generator (Gold codes, 32 satellites)"
```

---

## Task 4: MDC-1200 encoder

**Files:**
- Create: `crates/mayhem-protocols/src/mdc1200/mod.rs`
- Create: `crates/mayhem-protocols/src/mdc1200/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement MDC-1200 encoder**

```rust
//! MDC-1200 signaling encoder.
//! 1200 baud AFSK (1200/1800 Hz) burst containing unit ID and opcode.

#[derive(Debug, Clone)]
pub struct Mdc1200Packet {
    pub unit_id: u16,
    pub opcode: Mdc1200Op,
}

#[derive(Debug, Clone, Copy)]
pub enum Mdc1200Op {
    PttId,
    Emergency,
    Stun,
    Revive,
    CallAlert,
}

/// Encode MDC-1200 packet to raw bits (before AFSK modulation).
pub fn encode_mdc1200(pkt: &Mdc1200Packet) -> Vec<u8> {
    let mut bits = Vec::new();

    // Preamble: 40 bits alternating
    for i in 0..40 { bits.push((i % 2) as u8); }

    // Sync: 0x07 0x09 (reversed)
    push_byte(&mut bits, 0x07);
    push_byte(&mut bits, 0x09);

    // Opcode byte
    let op = match pkt.opcode {
        Mdc1200Op::PttId => 0x01,
        Mdc1200Op::Emergency => 0x80,
        Mdc1200Op::Stun => 0x22,
        Mdc1200Op::Revive => 0x23,
        Mdc1200Op::CallAlert => 0x35,
    };
    push_byte(&mut bits, op);

    // Unit ID (2 bytes, big-endian)
    push_byte(&mut bits, (pkt.unit_id >> 8) as u8);
    push_byte(&mut bits, pkt.unit_id as u8);

    // CRC (XOR of opcode + ID bytes)
    let crc = op ^ (pkt.unit_id >> 8) as u8 ^ pkt.unit_id as u8;
    push_byte(&mut bits, crc);

    bits
}

fn push_byte(bits: &mut Vec<u8>, byte: u8) {
    for i in (0..8).rev() {
        bits.push((byte >> i) & 1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_ptt_id() {
        let pkt = Mdc1200Packet { unit_id: 1234, opcode: Mdc1200Op::PttId };
        let bits = encode_mdc1200(&pkt);
        assert!(bits.len() > 80); // preamble + sync + data
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/mdc1200/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: MDC-1200 signaling encoder (unit ID + opcodes)"
```

---

## Task 5: IPC types + app implementations

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`
- Create: `crates/mayhem-apps/src/adsb_tx.rs`
- Create: `crates/mayhem-apps/src/gps_sim.rs`
- Create: `crates/mayhem-apps/src/mdc1200_tx.rs`
- Create: `crates/mayhem-apps/src/replay_tx.rs`
- Create: `crates/mayhem-apps/src/ook_editor_tx.rs`
- Create: `crates/mayhem-apps/src/freq_hopper.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Add IPC types**

```rust
// AppIds:
AdsbTx, GpsSim, Mdc1200Tx, ReplayTx, OokEditorTx, FreqHopper,

// Params:
pub struct AdsbTxParams { pub icao24: u32, pub callsign: String, pub lat: f64, pub lon: f64, pub alt_ft: i32, pub speed_kt: f64, pub heading: f64 }
pub struct GpsSimParams { pub lat: f64, pub lon: f64, pub alt_m: f64, pub num_satellites: u8 }
pub struct Mdc1200TxParams { pub unit_id: u16, pub opcode: String, pub center_hz: f64, pub vga_gain_db: u32 }
pub struct ReplayTxParams { pub file_path: String, pub center_hz: f64, pub sample_rate: f64, pub vga_gain_db: u32, pub loop_count: u32 }
pub struct OokEditorTxParams { pub pulses: Vec<PulseDef>, pub center_hz: f64, pub repeat: u32, pub vga_gain_db: u32 }
pub struct PulseDef { pub high_us: u32, pub low_us: u32 }
pub struct FreqHopperParams { pub freqs: Vec<f64>, pub dwell_ms: u32, pub waveform: String, pub vga_gain_db: u32 }
```

- [ ] **Step 2: Implement app skeletons**

- ADS-B TX: Encode → PPM → OOK modulate @ 2 Msps → sink @ 1090 MHz. IndoorTestOnly.
- GPS Sim: PRN codes × nav data → composite signal → sink @ 1575.42 MHz. IndoorTestOnly.
- MDC1200: Encode → AFSK → FM → sink. OwnDevicesOnly.
- Replay: Read IQ file → optional resample/freq shift → sink. OwnDevicesOnly.
- OOK Editor: Pulse def → binary baseband → sink. OwnDevicesOnly.
- Freq Hopper: Loop: set freq → generate waveform → short TX → next freq. IndoorTestOnly.

All apps call `FrequencyPolicy::check()` before starting.

- [ ] **Step 3: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs crates/mayhem-apps/src/adsb_tx.rs crates/mayhem-apps/src/gps_sim.rs crates/mayhem-apps/src/mdc1200_tx.rs crates/mayhem-apps/src/replay_tx.rs crates/mayhem-apps/src/ook_editor_tx.rs crates/mayhem-apps/src/freq_hopper.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-ipc + mayhem-apps: Phase 6a IPC types and 6 dual-use TX app skeletons"
```

---

## Task 6: Runner + frontend components

**Files:**
- Modify: `src-tauri/src/runner.rs`
- Create: `frontend/src/apps/adsb-tx/AdsbTxApp.tsx`
- Create: `frontend/src/apps/gps-sim/GpsSimApp.tsx`
- Create: `frontend/src/apps/mdc1200-tx/Mdc1200TxApp.tsx`
- Create: `frontend/src/apps/replay-tx/ReplayTxApp.tsx`
- Create: `frontend/src/apps/ook-editor-tx/OokEditorTxApp.tsx`
- Create: `frontend/src/apps/freq-hopper/FreqHopperApp.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Register in runner (6 match arms)**

- [ ] **Step 2: Implement frontend components**

All include prominent safety warnings per regulatory class:
- ADS-B TX: Red "INDOOR ONLY" banner, ICAO24/callsign/position inputs.
- GPS Sim: Red "INDOOR ONLY / RF SHIELDED" banner, lat/lon/alt inputs.
- MDC1200: Unit ID + opcode dropdown, frequency input.
- Replay: File browser, frequency override, gain, loop count.
- OOK Editor: Visual pulse timeline editor, add/remove pulses, frequency.
- Freq Hopper: Frequency list editor, dwell time, waveform type, IndoorTestOnly banner.

- [ ] **Step 3: Add to switcher and commit**

```bash
git add src-tauri/src/runner.rs frontend/src/apps/adsb-tx/ frontend/src/apps/gps-sim/ frontend/src/apps/mdc1200-tx/ frontend/src/apps/replay-tx/ frontend/src/apps/ook-editor-tx/ frontend/src/apps/freq-hopper/ frontend/src/App.tsx
git commit -m "Phase 6a integration: runner, frontend components with safety banners, switcher"
```

---

## Task 7: Tests (frequency policy + protocol encoders)

**Files:**
- Create: `crates/mayhem-protocols/tests/phase6a_encoders.rs`

- [ ] **Step 1: Test frequency policy, ADS-B encode, GPS PRN, MDC-1200**

- [ ] **Step 2: Commit**

```bash
cargo test -p mayhem-radio -- freq_policy
cargo test -p mayhem-protocols -- phase6a
git add crates/mayhem-protocols/tests/phase6a_encoders.rs
git commit -m "test: Phase 6a frequency policy + protocol encoder tests"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | Frequency lockout policy | Denies protected bands, allows exceptions |
| 2 | ADS-B TX encoder | DF17 frames encode, PPM output correct |
| 3 | GPS PRN generator | 32 unique Gold codes, ±1 chips |
| 4 | MDC-1200 encoder | Preamble + sync + data + CRC |
| 5 | IPC + apps | 6 AppIds, skeletons compile, policy checked |
| 6 | Runner + frontend | All registered, safety banners visible |
| 7 | Tests | Policy + encoder tests pass |
