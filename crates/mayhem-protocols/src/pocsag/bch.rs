//! BCH(31,21) encoder for POCSAG.
//!
//! Generator polynomial: x^10 + x^9 + x^8 + x^6 + x^5 + x^3 + 1 = 0x769.
//! Encoding is systematic: the 10 parity bits are the remainder of
//! `(data << 10)` divided by the generator polynomial in GF(2).

/// Generator polynomial for BCH(31,21): x^10 + x^9 + x^8 + x^6 + x^5 + x^3 + 1.
const GENERATOR: u32 = 0x769;

/// Compute 10 BCH parity bits for 21 data bits.
///
/// `data` must use only bits 20-0 (upper bits are ignored).
/// Returns the 10-bit remainder in bits 9-0.
pub fn encode_bch(data: u32) -> u32 {
    let mut rem = (data & 0x1F_FFFF) << 10;
    // Process each of the 21 data bit positions (from MSB down)
    for i in (0..=20).rev() {
        if rem & (1 << (i + 10)) != 0 {
            rem ^= GENERATOR << i;
        }
    }
    rem & 0x3FF
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The POCSAG idle/sync codeword used to fill idle batches.
    /// Bit layout (MSB first):
    ///   bit 31      : flag = 0 (address frame type)
    ///   bits 30..11 : 20-bit data field
    ///   bits 10..1  : 10-bit BCH parity
    ///   bit 0       : even parity
    const IDLE_CODEWORD: u32 = 0x7A89_C197;

    #[test]
    fn idle_codeword_bch_is_correct() {
        // Decompose the idle codeword.
        let flag: u32 = (IDLE_CODEWORD >> 31) & 1;
        let data_20: u32 = (IDLE_CODEWORD >> 11) & 0xF_FFFF;
        let expected_bch: u32 = (IDLE_CODEWORD >> 1) & 0x3FF;
        let even_parity: u32 = IDLE_CODEWORD & 1;

        // The 21-bit BCH input is [flag | data_20].
        let input_21 = (flag << 20) | data_20;
        let computed_bch = encode_bch(input_21);

        assert_eq!(
            computed_bch, expected_bch,
            "BCH parity mismatch: got 0x{computed_bch:03X}, want 0x{expected_bch:03X}"
        );

        // Sanity-check even parity: popcount of all 32 bits must be even.
        assert_eq!(
            IDLE_CODEWORD.count_ones() % 2,
            0,
            "idle codeword should have even Hamming weight"
        );

        // The parity bit (bit 0) makes bits 31..1 even.
        let upper_ones = (IDLE_CODEWORD >> 1).count_ones();
        assert_eq!(
            even_parity,
            upper_ones % 2,
            "even parity bit does not match upper bits"
        );
    }

    #[test]
    fn encode_bch_zero_data_gives_zero_parity() {
        // All-zero data has zero remainder (0 mod anything = 0).
        assert_eq!(encode_bch(0), 0);
    }

    #[test]
    fn encode_bch_ignores_bits_above_21() {
        // High bits beyond bit 20 must not affect the result.
        let base = encode_bch(0b10101010101010101010_1); // 21 bits set
        let with_garbage = encode_bch(0xFFE0_0000 | 0b10101010101010101010_1);
        assert_eq!(base, with_garbage, "high bits should be masked out");
    }
}
