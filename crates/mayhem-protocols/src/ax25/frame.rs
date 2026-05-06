//! AX.25 HDLC frame decoder.
//!
//! Supports NRZI decoding, HDLC bit-unstuffing/flag detection, and AX.25 frame parsing
//! (callsign addresses, control, PID, payload). CRC-16/CCITT (poly 0x8408, reversed).

use thiserror::Error;

/// A decoded AX.25 frame.
#[derive(Debug, Clone)]
pub struct Ax25Frame {
    pub dst: Callsign,
    pub src: Callsign,
    pub digipeaters: Vec<Callsign>,
    pub control: u8,
    pub pid: u8,
    pub payload: Vec<u8>,
}

/// An AX.25 callsign with optional SSID.
#[derive(Debug, Clone)]
pub struct Callsign {
    pub call: String,
    pub ssid: u8,
}

impl std::fmt::Display for Callsign {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.ssid == 0 {
            write!(f, "{}", self.call)
        } else {
            write!(f, "{}-{}", self.call, self.ssid)
        }
    }
}

/// Errors that can occur while decoding an AX.25 frame.
#[derive(Debug, Error)]
pub enum Ax25Error {
    #[error("frame too short ({0} bytes)")]
    TooShort(usize),
    #[error("CRC mismatch")]
    CrcMismatch,
    #[error("invalid address field")]
    InvalidAddress,
}

// ─── CRC-16/CCITT ────────────────────────────────────────────────────────────

/// CRC-16/CCITT: polynomial 0x8408 (bit-reversed), init 0xFFFF, final XOR 0xFFFF.
fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0x8408;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFF
}

// ─── Address parsing ─────────────────────────────────────────────────────────

/// Parse a single 7-byte AX.25 address entry.
/// Each character byte is shifted left 1 bit; SSID byte encodes SSID in bits 1–4
/// and the address-end flag in bit 0.
fn parse_callsign(bytes: &[u8]) -> Result<(Callsign, bool), Ax25Error> {
    if bytes.len() < 7 {
        return Err(Ax25Error::InvalidAddress);
    }
    let mut call = String::with_capacity(6);
    for &b in &bytes[..6] {
        let ch = b >> 1;
        if ch != b' ' {
            // Filter trailing spaces
            call.push(ch as char);
        }
    }
    let call = call.trim_end().to_string();
    let ssid_byte = bytes[6];
    let ssid = (ssid_byte >> 1) & 0x0F;
    let end = (ssid_byte & 0x01) != 0;
    Ok((Callsign { call, ssid }, end))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/// Decode an AX.25 frame from raw bytes (flags already stripped, bits already unstuffed).
/// The input **must** include the 2-byte FCS at the end (LSB first).
pub fn decode_ax25(data: &[u8]) -> Result<Ax25Frame, Ax25Error> {
    // Minimum: dst(7) + src(7) + control(1) + pid(1) + fcs(2) = 18 bytes
    if data.len() < 18 {
        return Err(Ax25Error::TooShort(data.len()));
    }

    // Verify CRC: compute over everything except the last 2 bytes, compare.
    let payload_end = data.len() - 2;
    let computed = crc16_ccitt(&data[..payload_end]);
    let stored = (data[payload_end] as u16) | ((data[payload_end + 1] as u16) << 8);
    if computed != stored {
        return Err(Ax25Error::CrcMismatch);
    }

    // Parse destination (first 7 bytes).
    let (dst, _) = parse_callsign(&data[0..7])?;

    // Parse source (next 7 bytes).
    let (src, src_end) = parse_callsign(&data[7..14])?;

    // Parse optional digipeater addresses.
    let mut digipeaters = Vec::new();
    let mut addr_end = src_end;
    let mut offset = 14;
    while !addr_end {
        if offset + 7 > payload_end {
            return Err(Ax25Error::InvalidAddress);
        }
        let (digi, end) = parse_callsign(&data[offset..offset + 7])?;
        digipeaters.push(digi);
        addr_end = end;
        offset += 7;
    }

    // Control + PID + payload.
    if offset + 2 > payload_end {
        return Err(Ax25Error::TooShort(data.len()));
    }
    let control = data[offset];
    let pid = data[offset + 1];
    let payload = data[offset + 2..payload_end].to_vec();

    Ok(Ax25Frame { dst, src, digipeaters, control, pid, payload })
}

/// NRZI decode: a transition (level change) represents 0; same level represents 1.
///
/// Each output bit at index `i` compares `bits[i]` with `bits[i+1]`, so the
/// output length is `bits.len() - 1`. This matches the standard AX.25 convention
/// where the differential is taken between adjacent symbol pairs.
pub fn nrzi_decode(bits: &[u8]) -> Vec<u8> {
    if bits.len() < 2 {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(bits.len() - 1);
    for i in 0..bits.len() - 1 {
        // Same level = 1, transition = 0
        out.push(if bits[i] == bits[i + 1] { 1 } else { 0 });
    }
    out
}

/// HDLC bit-unstuffing with flag (0x7E = `01111110`) detection.
///
/// Scans the bit stream for HDLC flags to delimit frames, removes stuffed zeros
/// (any `0` immediately following five consecutive `1`s), and returns each
/// complete inter-flag region as a byte vector (LSB-first packing).
pub fn hdlc_unstuff(bits: &[u8]) -> Vec<Vec<u8>> {
    let mut frames: Vec<Vec<u8>> = Vec::new();

    // State machine: scan for flags, collect frame bits between flags.
    let mut ones_run: u32 = 0;
    let mut frame_bits: Vec<u8> = Vec::new();
    let mut in_frame = false;
    let mut i = 0;

    while i < bits.len() {
        let bit = bits[i];

        // Check for HDLC flag pattern: 01111110.
        // We do this by peeking at an 8-bit window when we might be at a flag.
        if !in_frame {
            // Look for flag to start a frame.
            if i + 8 <= bits.len() {
                let window = &bits[i..i + 8];
                if window == [0, 1, 1, 1, 1, 1, 1, 0] {
                    in_frame = true;
                    frame_bits.clear();
                    ones_run = 0;
                    i += 8;
                    continue;
                }
            }
            i += 1;
            continue;
        }

        // Inside a frame: check for flag or abort.
        // If we see 01111110 that's a closing flag.
        if bit == 0 && ones_run == 0 {
            // Normal zero.
            frame_bits.push(0);
            i += 1;
            continue;
        }

        if bit == 1 {
            ones_run += 1;
            if ones_run < 5 {
                frame_bits.push(1);
                i += 1;
                continue;
            }
            if ones_run == 5 {
                // Peek at the next bit.
                if i + 1 < bits.len() {
                    let next = bits[i + 1];
                    if next == 0 {
                        // Check if this is a flag: need to look one more ahead.
                        // Pattern: 5 ones then 0 — could be stuffed 0 or start of flag.
                        // A flag is preceded by a leading 0: 0,1,1,1,1,1,1,0.
                        // Since we're already counting ones, a stuffed bit is just discard.
                        // But a flag closing = 0,1,1,1,1,1,1,0 where the leading 0 was
                        // already emitted. We need to look at whether i+2 follows as flag end.
                        // Simpler: after 5 ones + 0, if the bit after that closes a flag
                        // sequence we'd need the preceding 0. We handle this by checking
                        // the window from the last zero before the run.
                        // Per HDLC spec: after 5 ones, a 0 is always a stuffed bit — discard.
                        frame_bits.push(1); // the 5th one
                        ones_run = 0;
                        i += 1; // advance past the 5th one
                        i += 1; // skip stuffed zero
                        continue;
                    } else {
                        // next == 1: this is the 6th one — could be flag or abort.
                        frame_bits.push(1); // 5th one
                        i += 1;
                        continue;
                    }
                } else {
                    frame_bits.push(1);
                    i += 1;
                    continue;
                }
            }
            if ones_run == 6 {
                // 6th consecutive one — peek for the trailing 0 of a flag.
                if i + 1 < bits.len() && bits[i + 1] == 0 {
                    // This is the closing flag 0,1,1,1,1,1,1,0.
                    // The 6 ones we've been accumulating + trailing 0 = flag.
                    // Emit the frame (drop the last 6 bits we pushed as part of flag detection).
                    // We pushed ones_run-1 = 5 ones into frame_bits already;
                    // remove them from frame_bits.
                    let fb_len = frame_bits.len();
                    // We pushed bits for ones at ones_run=1..5 (5 bits), plus the leading 0
                    // that preceded the run (which is in frame_bits earlier).
                    // Actually we need to remove the 5 ones we pushed for ones_run 1..5.
                    if fb_len >= 5 {
                        frame_bits.truncate(fb_len - 5);
                    } else {
                        frame_bits.clear();
                    }
                    // Also remove the leading 0 of the flag if present.
                    if frame_bits.last() == Some(&0) {
                        frame_bits.pop();
                    }
                    // Pack bits into bytes and save frame.
                    let packed = pack_bits_lsb(&frame_bits);
                    if !packed.is_empty() {
                        frames.push(packed);
                    }
                    // Skip past the trailing 0 of the flag, then look for next frame.
                    i += 2; // past 6th one + trailing 0
                    ones_run = 0;
                    frame_bits.clear();
                    // Try to start another frame immediately (back-to-back flags).
                    // The trailing 0 of the closing flag might be the leading 0 of the
                    // next flag — but we consumed it, so just continue scanning.
                    in_frame = false;
                    continue;
                } else {
                    // 6 ones without trailing 0 — abort / invalid; drop frame.
                    frame_bits.push(1);
                    i += 1;
                    continue;
                }
            }
            // ones_run >= 7: abort sequence, discard frame.
            in_frame = false;
            frame_bits.clear();
            ones_run = 0;
            i += 1;
            continue;
        }

        // bit == 0 and ones_run > 0
        if ones_run > 0 && bit == 0 {
            if ones_run < 5 {
                frame_bits.push(0);
                ones_run = 0;
                i += 1;
                continue;
            }
            // ones_run == 5 handled above; if we get here ones_run could be 5 due to
            // the peek logic advancing. Treat as stuffed zero (already discarded above).
            ones_run = 0;
            i += 1;
            continue;
        }

        i += 1;
    }

    frames
}

/// Pack a bit vector (LSB-first) into bytes.
fn pack_bits_lsb(bits: &[u8]) -> Vec<u8> {
    let nbytes = bits.len() / 8;
    let mut out = Vec::with_capacity(nbytes);
    for i in 0..nbytes {
        let mut byte: u8 = 0;
        for j in 0..8 {
            if bits[i * 8 + j] != 0 {
                byte |= 1 << j;
            }
        }
        out.push(byte);
    }
    out
}
