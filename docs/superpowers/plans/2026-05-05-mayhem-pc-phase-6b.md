# Mayhem PC Phase 6b — Dual-Use TX: BTLE, NRF24, RFM69, Flipper, Keyfob, LGE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 ISM/IoT protocol transmitters: BTLE TX, NRF24 TX, RFM69 TX, Flipper TX, Keyfob Test TX, and LGE TX. All are RegulatoryClass::OwnDevicesOnly and use the existing arm/disarm + frequency lockout infrastructure from Phase 6a.

**Architecture:** New protocol frame builders in `mayhem-protocols` (BLE adv PDU, Enhanced ShockBurst, RFM69 packet, Flipper .sub parser, fixed-code OOK). GFSK modulator (reuse from Phase 0 Gaussian FSK) or OOK baseband generation, then HackRF sink.

**Spec reference:** `docs/superpowers/phase-specs/phase-6-dualuse-tx.md`

---

## File structure produced by this plan

```
crates/mayhem-protocols/src/
├── ble/
│   ├── mod.rs
│   └── adv_pdu.rs                 # BLE advertisement PDU builder
├── nrf24/
│   ├── mod.rs
│   └── shockburst.rs              # Enhanced ShockBurst frame builder
├── rfm69/
│   ├── mod.rs
│   └── packet.rs                  # RFM69-compatible packet builder
├── flipper/
│   ├── mod.rs
│   └── sub_file.rs                # Flipper Zero .sub file parser + regenerator
├── keyfob/
│   ├── mod.rs
│   └── fixed_code.rs              # PT2262/EV1527 fixed-code encoder
├── lge/
│   ├── mod.rs
│   └── encode.rs                  # LGE appliance protocol encoder
└── lib.rs

crates/mayhem-apps/src/
├── btle_tx.rs
├── nrf24_tx.rs
├── rfm69_tx.rs
├── flipper_tx.rs
├── keyfob_tx.rs
├── lge_tx.rs
└── lib.rs

frontend/src/apps/
├── btle-tx/BtleTxApp.tsx
├── nrf24-tx/Nrf24TxApp.tsx
├── rfm69-tx/Rfm69TxApp.tsx
├── flipper-tx/FlipperTxApp.tsx
├── keyfob-tx/KeyfobTxApp.tsx
└── lge-tx/LgeTxApp.tsx
```

---

## Task 1: BLE advertisement PDU builder

**Files:**
- Create: `crates/mayhem-protocols/src/ble/mod.rs`
- Create: `crates/mayhem-protocols/src/ble/adv_pdu.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement BLE adv PDU builder**

```rust
//! BLE (Bluetooth Low Energy) advertisement PDU builder.
//! Constructs valid BLE advertising channel packets for channels 37/38/39.

/// BLE advertising channel frequencies.
pub const BLE_ADV_CHANNELS: [(u8, f64); 3] = [
    (37, 2_402_000_000.0),
    (38, 2_426_000_000.0),
    (39, 2_480_000_000.0),
];

/// BLE PDU types.
#[derive(Debug, Clone, Copy)]
pub enum AdvPduType {
    AdvInd,          // Connectable undirected
    AdvDirectInd,    // Connectable directed
    AdvNonconnInd,   // Non-connectable undirected
    ScanReq,         // Scan request
    ScanRsp,         // Scan response
    AdvScanInd,      // Scannable undirected
}

/// A complete BLE advertising channel packet (ready for GFSK modulation).
#[derive(Debug, Clone)]
pub struct BleAdvPacket {
    pub channel: u8,
    pub bytes: Vec<u8>,  // Complete packet: preamble + access addr + PDU + CRC
}

/// Build a BLE advertisement packet.
///
/// - `pdu_type`: advertisement type.
/// - `adv_addr`: 6-byte advertiser address.
/// - `adv_data`: advertisement data (up to 31 bytes).
/// - `channel`: BLE channel (37, 38, or 39).
pub fn build_adv_packet(pdu_type: AdvPduType, adv_addr: &[u8; 6], adv_data: &[u8], channel: u8) -> BleAdvPacket {
    let mut packet = Vec::new();

    // Preamble (1 byte: 0xAA for access address starting with 0)
    packet.push(0xAA);

    // Access Address (4 bytes): advertising = 0x8E89BED6
    packet.extend_from_slice(&[0xD6, 0xBE, 0x89, 0x8E]); // little-endian

    // PDU Header (2 bytes)
    let pdu_type_bits = match pdu_type {
        AdvPduType::AdvInd => 0x00,
        AdvPduType::AdvDirectInd => 0x01,
        AdvPduType::AdvNonconnInd => 0x02,
        AdvPduType::ScanReq => 0x03,
        AdvPduType::ScanRsp => 0x04,
        AdvPduType::AdvScanInd => 0x06,
    };
    let pdu_len = 6 + adv_data.len().min(31);
    packet.push(pdu_type_bits); // header byte 0: type + flags
    packet.push(pdu_len as u8); // header byte 1: length

    // PDU Payload: AdvA (6 bytes) + AdvData
    packet.extend_from_slice(adv_addr);
    packet.extend_from_slice(&adv_data[..adv_data.len().min(31)]);

    // CRC (3 bytes): BLE uses CRC-24 with init 0x555555, poly 0x100065B
    let crc = ble_crc24(&packet[5..]); // CRC over PDU (header + payload)
    packet.push((crc & 0xFF) as u8);
    packet.push(((crc >> 8) & 0xFF) as u8);
    packet.push(((crc >> 16) & 0xFF) as u8);

    BleAdvPacket { channel, bytes: packet }
}

/// BLE whitening: XOR with channel-specific LFSR sequence.
pub fn ble_whiten(data: &mut [u8], channel: u8) {
    let mut lfsr: u8 = channel | 0x40; // init = channel number + bit 6 set
    for byte in data.iter_mut() {
        let mut whitened = 0u8;
        for bit in 0..8 {
            let data_bit = (*byte >> bit) & 1;
            let lfsr_bit = lfsr & 1;
            whitened |= (data_bit ^ lfsr_bit) << bit;
            let feedback = ((lfsr >> 0) ^ (lfsr >> 4)) & 1;
            lfsr = (lfsr >> 1) | (feedback << 6);
        }
        *byte = whitened;
    }
}

/// BLE CRC-24 (polynomial 0x100065B, init 0x555555).
fn ble_crc24(data: &[u8]) -> u32 {
    let mut crc: u32 = 0x555555;
    for &byte in data {
        for bit in 0..8 {
            let d = ((byte >> bit) & 1) as u32;
            let msb = (crc >> 23) & 1;
            crc = ((crc << 1) & 0xFFFFFF) | d;
            if msb != 0 {
                crc ^= 0x00065B;
            }
        }
    }
    crc & 0xFFFFFF
}

/// Convert BLE packet to GFSK symbol stream (1 Mbps, ±250 kHz deviation).
/// Each byte → 8 bits LSB first.
pub fn packet_to_symbols(packet: &BleAdvPacket) -> Vec<u8> {
    let mut symbols = Vec::with_capacity(packet.bytes.len() * 8);
    for &byte in &packet.bytes {
        for bit in 0..8 {
            symbols.push((byte >> bit) & 1);
        }
    }
    symbols
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_basic_adv() {
        let addr = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
        let data = [0x02, 0x01, 0x06]; // flags AD
        let pkt = build_adv_packet(AdvPduType::AdvNonconnInd, &addr, &data, 37);
        assert!(pkt.bytes.len() > 10);
    }

    #[test]
    fn crc24_not_zero() {
        let data = [0x00, 0x06, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
        let crc = ble_crc24(&data);
        assert_ne!(crc, 0);
    }

    #[test]
    fn symbols_length() {
        let addr = [0; 6];
        let pkt = build_adv_packet(AdvPduType::AdvInd, &addr, &[], 37);
        let syms = packet_to_symbols(&pkt);
        assert_eq!(syms.len(), pkt.bytes.len() * 8);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/ble/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: BLE advertisement PDU builder (CRC-24, whitening, GFSK symbols)"
```

---

## Task 2: NRF24 Enhanced ShockBurst frame builder

**Files:**
- Create: `crates/mayhem-protocols/src/nrf24/mod.rs`
- Create: `crates/mayhem-protocols/src/nrf24/shockburst.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement ShockBurst frame builder**

```rust
//! nRF24L01+ Enhanced ShockBurst packet builder.
//! Frame: Preamble (1B) + Address (3-5B) + PCF (9b) + Payload (0-32B) + CRC (1-2B).

#[derive(Debug, Clone)]
pub struct Nrf24Config {
    pub address: Vec<u8>,      // 3-5 bytes
    pub payload: Vec<u8>,      // 0-32 bytes
    pub data_rate: Nrf24Rate,
    pub crc_len: u8,           // 1 or 2 bytes
    pub auto_ack: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum Nrf24Rate {
    Rate250Kbps,
    Rate1Mbps,
    Rate2Mbps,
}

impl Nrf24Rate {
    pub fn symbol_rate(&self) -> f32 {
        match self {
            Self::Rate250Kbps => 250_000.0,
            Self::Rate1Mbps => 1_000_000.0,
            Self::Rate2Mbps => 2_000_000.0,
        }
    }

    pub fn channel_hz(&self, channel: u8) -> f64 {
        2_400_000_000.0 + channel as f64 * 1_000_000.0
    }
}

/// Build an Enhanced ShockBurst packet as raw bytes.
pub fn build_shockburst(cfg: &Nrf24Config) -> Vec<u8> {
    let mut packet = Vec::new();

    // Preamble: 1 byte (0xAA if address starts with 0 bit, 0x55 if starts with 1)
    let preamble = if cfg.address.first().map_or(false, |&b| b & 0x80 != 0) {
        0x55u8
    } else {
        0xAA
    };
    packet.push(preamble);

    // Address (3-5 bytes)
    packet.extend_from_slice(&cfg.address);

    // Packet Control Field (9 bits): payload length (6b) + PID (2b) + NO_ACK (1b)
    let pcf_len = (cfg.payload.len() as u8) & 0x3F;
    let pcf_pid = 0u8; // packet ID (cycles 0-3 for retransmit detection)
    let pcf_noack = if cfg.auto_ack { 0u8 } else { 1 };
    let pcf_byte1 = (pcf_len << 2) | (pcf_pid & 0x03);
    let pcf_byte2 = pcf_noack; // only 1 bit used, packed with first payload bit
    packet.push(pcf_byte1);
    packet.push(pcf_byte2);

    // Payload (0-32 bytes)
    packet.extend_from_slice(&cfg.payload);

    // CRC (1 or 2 bytes)
    let crc = nrf24_crc(&packet[1..], cfg.crc_len); // CRC over address + PCF + payload
    if cfg.crc_len >= 1 {
        packet.push((crc >> 8) as u8);
    }
    if cfg.crc_len >= 2 {
        packet.push(crc as u8);
    }

    packet
}

/// Convert packet to GFSK symbols (1 bit per symbol).
pub fn packet_to_symbols(packet: &[u8]) -> Vec<u8> {
    let mut symbols = Vec::with_capacity(packet.len() * 8);
    for &byte in packet {
        for bit in (0..8).rev() { // MSB first for nRF24
            symbols.push((byte >> bit) & 1);
        }
    }
    symbols
}

fn nrf24_crc(data: &[u8], crc_len: u8) -> u16 {
    match crc_len {
        1 => {
            // CRC-8: poly 0x107, init 0xFF
            let mut crc = 0xFFu8;
            for &byte in data {
                crc ^= byte;
                for _ in 0..8 {
                    if crc & 0x80 != 0 { crc = (crc << 1) ^ 0x07; }
                    else { crc <<= 1; }
                }
            }
            crc as u16
        }
        _ => {
            // CRC-16: poly 0x11021, init 0xFFFF
            let mut crc = 0xFFFFu16;
            for &byte in data {
                crc ^= (byte as u16) << 8;
                for _ in 0..8 {
                    if crc & 0x8000 != 0 { crc = (crc << 1) ^ 0x1021; }
                    else { crc <<= 1; }
                }
            }
            crc
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_basic_packet() {
        let cfg = Nrf24Config {
            address: vec![0xE7, 0xE7, 0xE7, 0xE7, 0xE7],
            payload: vec![0x01, 0x02, 0x03],
            data_rate: Nrf24Rate::Rate1Mbps,
            crc_len: 2,
            auto_ack: false,
        };
        let pkt = build_shockburst(&cfg);
        assert!(pkt.len() > 10);
    }

    #[test]
    fn symbols_msb_first() {
        let pkt = vec![0x80]; // 10000000
        let syms = packet_to_symbols(&pkt);
        assert_eq!(syms[0], 1);
        assert_eq!(syms[1], 0);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-protocols/src/nrf24/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: nRF24 Enhanced ShockBurst frame builder (CRC-8/16)"
```

---

## Task 3: RFM69 packet builder + Flipper .sub parser + Keyfob encoder + LGE

**Files:**
- Create: `crates/mayhem-protocols/src/rfm69/mod.rs`
- Create: `crates/mayhem-protocols/src/rfm69/packet.rs`
- Create: `crates/mayhem-protocols/src/flipper/mod.rs`
- Create: `crates/mayhem-protocols/src/flipper/sub_file.rs`
- Create: `crates/mayhem-protocols/src/keyfob/mod.rs`
- Create: `crates/mayhem-protocols/src/keyfob/fixed_code.rs`
- Create: `crates/mayhem-protocols/src/lge/mod.rs`
- Create: `crates/mayhem-protocols/src/lge/encode.rs`
- Modify: `crates/mayhem-protocols/src/lib.rs`

- [ ] **Step 1: Implement RFM69 packet builder**

```rust
//! RFM69 radio module compatible packet builder.
//! Generates packets matching the SX1231 / RFM69 packet format.

#[derive(Debug, Clone)]
pub struct Rfm69Packet {
    pub sync_word: Vec<u8>,    // 1-8 bytes
    pub node_addr: u8,
    pub payload: Vec<u8>,      // variable length
    pub crc: bool,
}

pub fn build_rfm69_packet(pkt: &Rfm69Packet) -> Vec<u8> {
    let mut bytes = Vec::new();
    // Preamble (4 bytes of 0xAA)
    bytes.extend_from_slice(&[0xAA; 4]);
    // Sync word
    bytes.extend_from_slice(&pkt.sync_word);
    // Length byte
    bytes.push(pkt.payload.len() as u8 + 1); // +1 for node addr
    // Node address
    bytes.push(pkt.node_addr);
    // Payload
    bytes.extend_from_slice(&pkt.payload);
    // CRC-16 (CCITT) if enabled
    if pkt.crc {
        let crc = crc16_ccitt(&bytes[pkt.sync_word.len() + 4..]); // over length+addr+payload
        bytes.push((crc >> 8) as u8);
        bytes.push(crc as u8);
    }
    bytes
}

fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 { crc = (crc << 1) ^ 0x1021; }
            else { crc <<= 1; }
        }
    }
    crc
}
```

- [ ] **Step 2: Implement Flipper .sub file parser**

```rust
//! Flipper Zero .sub file parser.
//! Parses the text-based .sub format and regenerates pulse sequences.

#[derive(Debug, Clone)]
pub struct FlipperSubFile {
    pub frequency: f64,
    pub preset: String,        // "FuriHalSubGhzPresetOok650Async" etc.
    pub protocol: String,
    pub raw_data: Vec<i32>,    // alternating durations: +pulse, -gap (microseconds)
}

/// Parse a Flipper .sub file from text content.
pub fn parse_sub_file(content: &str) -> Option<FlipperSubFile> {
    let mut frequency = 0.0f64;
    let mut preset = String::new();
    let mut protocol = String::new();
    let mut raw_data = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("Frequency: ") {
            frequency = val.parse().ok()?;
        } else if let Some(val) = line.strip_prefix("Preset: ") {
            preset = val.to_string();
        } else if let Some(val) = line.strip_prefix("Protocol: ") {
            protocol = val.to_string();
        } else if let Some(val) = line.strip_prefix("RAW_Data: ") {
            for token in val.split_whitespace() {
                if let Ok(v) = token.parse::<i32>() {
                    raw_data.push(v);
                }
            }
        }
    }

    if frequency == 0.0 || raw_data.is_empty() {
        return None;
    }

    Some(FlipperSubFile { frequency, preset, protocol, raw_data })
}

/// Convert raw data (±microseconds) to OOK baseband samples at given sample rate.
pub fn sub_to_baseband(sub: &FlipperSubFile, sample_rate: f32) -> Vec<u8> {
    let mut baseband = Vec::new();
    for &duration in &sub.raw_data {
        let abs_us = duration.unsigned_abs();
        let n_samples = (abs_us as f32 * sample_rate / 1_000_000.0).round() as usize;
        let level = if duration > 0 { 1u8 } else { 0u8 };
        baseband.extend(std::iter::repeat(level).take(n_samples));
    }
    baseband
}
```

- [ ] **Step 3: Implement fixed-code keyfob encoder**

```rust
//! Fixed-code keyfob encoder (PT2262, EV1527).

#[derive(Debug, Clone, Copy)]
pub enum KeyfobProtocol {
    Pt2262,
    Ev1527,
}

#[derive(Debug, Clone)]
pub struct KeyfobMessage {
    pub protocol: KeyfobProtocol,
    pub code: u32,       // code bits (20 bits for PT2262, 24 for EV1527)
    pub button: u8,      // button bits (4 bits)
    pub repeats: u32,
}

/// Encode keyfob message to pulse durations (microseconds): Vec<(high_us, low_us)>.
pub fn encode_keyfob(msg: &KeyfobMessage) -> Vec<(u32, u32)> {
    let (short, long, sync_high, sync_low, total_bits) = match msg.protocol {
        KeyfobProtocol::Pt2262 => (350u32, 1050u32, 350u32, 10850u32, 24u8),
        KeyfobProtocol::Ev1527 => (350, 1050, 350, 10850, 24),
    };

    let mut pulses = Vec::new();
    let full_code = (msg.code << 4) | (msg.button as u32 & 0x0F);

    for _ in 0..msg.repeats {
        // Sync pulse
        pulses.push((sync_high, sync_low));

        // Data bits
        for bit_idx in (0..total_bits).rev() {
            let bit = (full_code >> bit_idx) & 1;
            if bit == 1 {
                pulses.push((long, short));
            } else {
                pulses.push((short, long));
            }
        }
    }

    pulses
}

/// Convert pulse pairs to OOK baseband at given sample rate.
pub fn keyfob_to_baseband(pulses: &[(u32, u32)], sample_rate: f32) -> Vec<u8> {
    let mut baseband = Vec::new();
    for &(high_us, low_us) in pulses {
        let high_samples = (high_us as f32 * sample_rate / 1_000_000.0).round() as usize;
        let low_samples = (low_us as f32 * sample_rate / 1_000_000.0).round() as usize;
        baseband.extend(std::iter::repeat(1u8).take(high_samples));
        baseband.extend(std::iter::repeat(0u8).take(low_samples));
    }
    baseband
}
```

- [ ] **Step 4: Implement LGE encoder (stub)**

```rust
//! LGE appliance protocol encoder.

#[derive(Debug, Clone)]
pub struct LgeCommand {
    pub device_addr: u8,
    pub command: u8,
    pub payload: Vec<u8>,
}

pub fn encode_lge(cmd: &LgeCommand) -> Vec<u8> {
    let mut bits = Vec::new();
    // Preamble
    for i in 0..16 { bits.push((i % 2) as u8); }
    // Sync
    bits.extend_from_slice(&[1, 1, 1, 0, 0, 1, 0, 1]);
    // Address
    for i in (0..8).rev() { bits.push((cmd.device_addr >> i) & 1); }
    // Command
    for i in (0..8).rev() { bits.push((cmd.command >> i) & 1); }
    // Payload
    for &byte in &cmd.payload {
        for i in (0..8).rev() { bits.push((byte >> i) & 1); }
    }
    // Checksum (XOR)
    let chk = cmd.device_addr ^ cmd.command ^ cmd.payload.iter().fold(0u8, |a, b| a ^ b);
    for i in (0..8).rev() { bits.push((chk >> i) & 1); }
    bits
}
```

- [ ] **Step 5: Commit**

```bash
git add crates/mayhem-protocols/src/rfm69/ crates/mayhem-protocols/src/flipper/ crates/mayhem-protocols/src/keyfob/ crates/mayhem-protocols/src/lge/ crates/mayhem-protocols/src/lib.rs
git commit -m "mayhem-protocols: RFM69 + Flipper .sub + keyfob (PT2262/EV1527) + LGE encoders"
```

---

## Task 4: IPC types for Phase 6b apps

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`

- [ ] **Step 1: Add AppId variants and param types**

```rust
// AppIds:
BtleTx, Nrf24Tx, Rfm69Tx, FlipperTx, KeyfobTx, LgeTx,

// Params:
pub struct BtleTxParams { pub adv_addr: String, pub adv_data_hex: String, pub channel: u8, pub interval_ms: u32, pub count: u32 }
pub struct Nrf24TxParams { pub address_hex: String, pub payload_hex: String, pub channel: u8, pub data_rate: String, pub count: u32 }
pub struct Rfm69TxParams { pub node_addr: u8, pub sync_word_hex: String, pub payload_hex: String, pub center_hz: f64, pub bitrate: u32, pub deviation_hz: f32 }
pub struct FlipperTxParams { pub file_path: String, pub repeat: u32 }
pub struct KeyfobTxParams { pub protocol: String, pub code: u32, pub button: u8, pub center_hz: f64, pub repeats: u32 }
pub struct LgeTxParams { pub device_addr: u8, pub command: u8, pub payload_hex: String, pub center_hz: f64 }
```

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs
git commit -m "mayhem-ipc: Phase 6b app IDs and param types (BLE, NRF24, RFM69, Flipper, Keyfob, LGE)"
```

---

## Task 5: App implementations (all 6)

**Files:**
- Create: `crates/mayhem-apps/src/btle_tx.rs`
- Create: `crates/mayhem-apps/src/nrf24_tx.rs`
- Create: `crates/mayhem-apps/src/rfm69_tx.rs`
- Create: `crates/mayhem-apps/src/flipper_tx.rs`
- Create: `crates/mayhem-apps/src/keyfob_tx.rs`
- Create: `crates/mayhem-apps/src/lge_tx.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`

- [ ] **Step 1: Implement app skeletons**

All are RegulatoryClass::OwnDevicesOnly and call FrequencyPolicy::check():
- BTLE TX: Build adv PDU → GFSK 1 Mbps ±250 kHz → sink @ 2.4 GHz channel.
- NRF24 TX: Build ShockBurst → GFSK (rate-dependent) → sink @ 2.4 GHz channel.
- RFM69 TX: Build packet → FSK (configurable bitrate/deviation) → sink.
- Flipper TX: Parse .sub → regenerate OOK baseband → sink @ original freq.
- Keyfob TX: Encode fixed code → OOK baseband → sink @ 315/433 MHz.
- LGE TX: Encode command → OOK/FSK → sink.

- [ ] **Step 2: Commit**

```bash
git add crates/mayhem-apps/src/btle_tx.rs crates/mayhem-apps/src/nrf24_tx.rs crates/mayhem-apps/src/rfm69_tx.rs crates/mayhem-apps/src/flipper_tx.rs crates/mayhem-apps/src/keyfob_tx.rs crates/mayhem-apps/src/lge_tx.rs crates/mayhem-apps/src/lib.rs
git commit -m "mayhem-apps: Phase 6b ISM/IoT TX app skeletons (BLE, NRF24, RFM69, Flipper, Keyfob, LGE)"
```

---

## Task 6: Runner + frontend components + switcher

**Files:**
- Modify: `src-tauri/src/runner.rs`
- Create: `frontend/src/apps/btle-tx/BtleTxApp.tsx`
- Create: `frontend/src/apps/nrf24-tx/Nrf24TxApp.tsx`
- Create: `frontend/src/apps/rfm69-tx/Rfm69TxApp.tsx`
- Create: `frontend/src/apps/flipper-tx/FlipperTxApp.tsx`
- Create: `frontend/src/apps/keyfob-tx/KeyfobTxApp.tsx`
- Create: `frontend/src/apps/lge-tx/LgeTxApp.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Register in runner**

- [ ] **Step 2: Implement frontend components**

- BTLE TX: Address input, AD data builder (type + value), channel selector, interval, count.
- NRF24 TX: Address hex, payload hex, channel (0-125), rate selector, count.
- RFM69 TX: Node addr, sync word, payload hex, frequency, bitrate, deviation.
- Flipper TX: File browser (.sub files), preview (protocol + frequency), repeat count.
- Keyfob TX: Protocol (PT2262/EV1527), code bits input, button selector, frequency, repeats.
- LGE TX: Device addr, command, payload hex, frequency.

All show "OWN DEVICES ONLY" warning prominently.

- [ ] **Step 3: Add to switcher and commit**

```bash
git add src-tauri/src/runner.rs frontend/src/apps/btle-tx/ frontend/src/apps/nrf24-tx/ frontend/src/apps/rfm69-tx/ frontend/src/apps/flipper-tx/ frontend/src/apps/keyfob-tx/ frontend/src/apps/lge-tx/ frontend/src/App.tsx
git commit -m "Phase 6b integration: runner, 6 ISM/IoT TX frontend components, switcher"
```

---

## Task 7: Protocol tests

**Files:**
- Create: `crates/mayhem-protocols/tests/phase6b_protocols.rs`

- [ ] **Step 1: Write tests**

- BLE: build adv packet, verify CRC, verify whitening is reversible.
- NRF24: build packet, verify CRC, verify preamble logic.
- Flipper: parse sample .sub file content, regenerate baseband.
- Keyfob: encode known code, verify pulse timing.

- [ ] **Step 2: Commit**

```bash
cargo test -p mayhem-protocols -- phase6b
git add crates/mayhem-protocols/tests/phase6b_protocols.rs
git commit -m "test: Phase 6b protocol tests (BLE, NRF24, Flipper .sub, keyfob)"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | BLE adv PDU builder | CRC-24, whitening, symbol output |
| 2 | NRF24 ShockBurst builder | CRC-8/16, MSB-first symbols |
| 3 | RFM69 + Flipper + Keyfob + LGE | All encode correctly |
| 4 | IPC types | 6 AppIds + param types |
| 5 | App skeletons | All 6 compile, OwnDevicesOnly |
| 6 | Runner + frontend | Registered, warnings visible |
| 7 | Protocol tests | All tests pass |
