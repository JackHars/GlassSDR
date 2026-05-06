//! Integration tests for the POCSAG protocol codec.

use mayhem_protocols::pocsag::bch::encode_bch;

/// Known POCSAG idle codeword (fills unused codeword slots in a batch).
const IDLE_CODEWORD: u32 = 0x7A89_C197;

#[test]
fn idle_codeword_bch_round_trips() {
    let flag: u32 = (IDLE_CODEWORD >> 31) & 1;
    let data_20: u32 = (IDLE_CODEWORD >> 11) & 0xF_FFFF;
    let expected_bch: u32 = (IDLE_CODEWORD >> 1) & 0x3FF;

    let input_21 = (flag << 20) | data_20;
    assert_eq!(
        encode_bch(input_21),
        expected_bch,
        "BCH(31,21) parity for idle codeword should be 0x{expected_bch:03X}"
    );
}

#[test]
fn idle_codeword_even_parity() {
    assert_eq!(
        IDLE_CODEWORD.count_ones() % 2,
        0,
        "idle codeword 0x{IDLE_CODEWORD:08X} must have even Hamming weight"
    );
}
