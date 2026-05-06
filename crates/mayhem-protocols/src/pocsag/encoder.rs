//! Full POCSAG message encoder — preamble + sync + batch framing.

use super::charset::{encode_alphanumeric, encode_numeric};
use super::codeword::{address_codeword, idle_codeword, message_codeword, sync_codeword};

/// Content type carried by a POCSAG message.
#[derive(Debug, Clone)]
pub enum MessageType {
    Numeric(String),
    Alphanumeric(String),
    ToneOnly,
}

/// A single POCSAG message ready to be encoded into a bitstream.
#[derive(Debug, Clone)]
pub struct PocsagMessage {
    /// Receiver Identification Code (0..=2_097_151).
    pub ric: u32,
    /// 2-bit function code (0..=3).
    pub function: u8,
    /// Message payload.
    pub content: MessageType,
    /// Baud rate — 512, 1200, or 2400. Informational only; does not affect bit encoding.
    pub baud_rate: u16,
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// Push all 32 bits of `val` into `bits`, MSB first.
fn push_u32(bits: &mut Vec<bool>, val: u32) {
    for shift in (0..32).rev() {
        bits.push((val >> shift) & 1 != 0);
    }
}

// ── public API ────────────────────────────────────────────────────────────────

/// Encode a POCSAG message into a complete bitstream (`Vec<bool>`).
///
/// Layout:
/// 1. **Preamble** — 576 alternating bits, starting with `1`.
/// 2. **One or more batches**, each:
///    - 32-bit sync codeword
///    - 16 codewords (8 frames × 2 codewords, 512 bits)
///
/// The address codeword is placed at slot index `(ric % 8) * 2`.
/// Message codewords follow immediately; idle codewords fill any unused slots.
/// If the message overflows past slot 15 of a batch, a new batch is started.
pub fn encode_pocsag(msg: &PocsagMessage) -> Vec<bool> {
    // ── 1. preamble ──────────────────────────────────────────────────────────
    let mut bits: Vec<bool> = (0..576).map(|i| i % 2 == 0).collect();

    // ── 2. build message codewords ───────────────────────────────────────────
    let content_bits: Vec<bool> = match &msg.content {
        MessageType::Numeric(s) => encode_numeric(s),
        MessageType::Alphanumeric(s) => encode_alphanumeric(s),
        MessageType::ToneOnly => Vec::new(),
    };

    // Pack content bits into 20-bit chunks → message codewords.
    let mut msg_codewords: Vec<u32> = Vec::new();
    let mut i = 0;
    while i < content_bits.len() {
        let mut chunk = 0u32;
        for bit_idx in 0..20 {
            if i + bit_idx < content_bits.len() && content_bits[i + bit_idx] {
                chunk |= 1 << (19 - bit_idx);
            }
        }
        msg_codewords.push(message_codeword(chunk));
        i += 20;
    }

    // ── 3. build batches ─────────────────────────────────────────────────────
    // Starting slot within the first batch (address codeword position).
    let start_slot = ((msg.ric % 8) * 2) as usize;

    // Total codeword slots needed: 1 (address) + message codewords.
    // These must fit into 16-slot batches starting at `start_slot`.
    //
    // We build a flat list of codewords that occupies exactly the number of
    // batches required, then serialise it.

    // Number of slots consumed: address + message codewords.
    let used_slots = 1 + msg_codewords.len();
    // Slots available in the first batch from start_slot onwards.
    let first_batch_capacity = 16 - start_slot;
    // Extra slots needed beyond the first batch.
    let overflow = if used_slots > first_batch_capacity {
        used_slots - first_batch_capacity
    } else {
        0
    };
    // Each additional batch has 16 slots; round up to full batches.
    let extra_batches = overflow.div_ceil(16);
    let total_batches = 1 + extra_batches;
    let total_slots = total_batches * 16;

    // Build the flat codeword array (all idle by default).
    let mut codewords: Vec<u32> = vec![idle_codeword(); total_slots];

    // Place the address codeword.
    codewords[start_slot] = address_codeword(msg.ric, msg.function);

    // Place the message codewords immediately after.
    for (k, &cw) in msg_codewords.iter().enumerate() {
        codewords[start_slot + 1 + k] = cw;
    }

    // ── 4. serialise batches ─────────────────────────────────────────────────
    for batch in 0..total_batches {
        push_u32(&mut bits, sync_codeword());
        for slot in 0..16 {
            push_u32(&mut bits, codewords[batch * 16 + slot]);
        }
    }

    bits
}
