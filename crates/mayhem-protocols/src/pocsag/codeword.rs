//! POCSAG codeword builders.
//!
//! Each codeword is 32 bits transmitted MSB-first:
//!   bit 31      : flag (0 = address, 1 = message)
//!   bits 30..11 : 20 data bits
//!   bits 10..1  : BCH(31,21) parity over bits 31..11
//!   bit 0       : even parity over bits 31..1

use super::bch::encode_bch;

/// Assemble a 32-bit POCSAG codeword from a 1-bit flag and 20 data bits.
///
/// Steps:
///   1. Build the 21-bit BCH input: `(flag << 20) | data_20`.
///   2. Compute 10-bit BCH parity.
///   3. Build the 31-bit value: `(flag << 30) | (data_20 << 10) | parity`.
///   4. Append an even-parity bit so the full 32-bit word has even popcount.
fn assemble_codeword(flag: u32, data_20: u32) -> u32 {
    let bch_input = (flag << 20) | (data_20 & 0xF_FFFF);
    let parity = encode_bch(bch_input);
    let word31 = (flag << 30) | (data_20 << 10) | parity;
    let even_parity = word31.count_ones() % 2;
    (word31 << 1) | even_parity
}

/// POCSAG frame synchronisation codeword (0x7CD215D8).
///
/// This is a fixed bit pattern defined by the POCSAG standard; it is not
/// produced by the BCH encoder.
pub const fn sync_codeword() -> u32 {
    0x7CD2_15D8
}

/// POCSAG idle codeword (0x7A89C197).
///
/// Fills unused codeword slots in a batch.
pub const fn idle_codeword() -> u32 {
    0x7A89_C197
}

/// Build an address codeword for the given RIC and function code.
///
/// * `ric`      – receiver identification code, 0..=2_097_151 (21 bits).
///               Bits 2..0 select the frame position within a batch.
///               Bits 20..3 are the 18-bit address field encoded in the word.
/// * `function` – 2-bit service type, 0..=3.
pub fn address_codeword(ric: u32, function: u8) -> u32 {
    let addr_18 = (ric >> 3) & 0x3_FFFF;
    let data_20 = (addr_18 << 2) | (function as u32 & 0x3);
    assemble_codeword(0, data_20)
}

/// Build a message codeword from 20 packed data bits.
///
/// * `data_20` – 20-bit payload (only bits 19..0 are used).
pub fn message_codeword(data_20: u32) -> u32 {
    assemble_codeword(1, data_20)
}
