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

mod charset {
    use mayhem_protocols::pocsag::charset::{encode_alphanumeric, encode_numeric};

    #[test]
    fn numeric_length() {
        let bits = encode_numeric("12345");
        assert_eq!(bits.len(), 20); // 5 chars × 4 bits
    }

    #[test]
    fn numeric_digit_one() {
        let bits = encode_numeric("1");
        // '1' = 0x1 = 0001, MSB first → [false, false, false, true]
        assert_eq!(bits, vec![false, false, false, true]);
    }

    #[test]
    fn numeric_special_chars() {
        let bits = encode_numeric("*");
        // '*' = 0xA = 1010, MSB first → [true, false, true, false]
        assert_eq!(bits, vec![true, false, true, false]);
    }

    #[test]
    fn alpha_length() {
        let bits = encode_alphanumeric("Hello");
        assert_eq!(bits.len(), 35); // 5 × 7
    }

    #[test]
    fn alpha_char_a() {
        let bits = encode_alphanumeric("A");
        // 'A' = 65 = 0b1000001, LSB first → [true, false, false, false, false, false, true]
        assert_eq!(bits, vec![true, false, false, false, false, false, true]);
    }

    #[test]
    fn alpha_space() {
        let bits = encode_alphanumeric(" ");
        // ' ' = 32 = 0b0100000, LSB first → [false, false, false, false, false, true, false]
        assert_eq!(bits, vec![false, false, false, false, false, true, false]);
    }
}

mod codeword {
    use mayhem_protocols::pocsag::codeword::{
        address_codeword, idle_codeword, message_codeword, sync_codeword,
    };

    #[test]
    fn sync_constant() {
        assert_eq!(sync_codeword(), 0x7CD215D8);
    }

    #[test]
    fn idle_constant() {
        assert_eq!(idle_codeword(), 0x7A89C197);
    }

    #[test]
    fn idle_even_parity() {
        assert_eq!(idle_codeword().count_ones() % 2, 0);
    }

    #[test]
    fn address_codeword_even_parity() {
        for ric in [0u32, 1, 8, 100, 1234567, 2097151] {
            for func in 0..4u8 {
                let cw = address_codeword(ric, func);
                assert_eq!(cw.count_ones() % 2, 0, "parity fail ric={ric} func={func}");
                assert_eq!(cw >> 31, 0, "flag must be 0 for address");
            }
        }
    }

    #[test]
    fn message_codeword_even_parity() {
        for data in [0u32, 0xFFFFF, 0xAAAAA, 0x55555, 0x12345] {
            let cw = message_codeword(data);
            assert_eq!(cw.count_ones() % 2, 0, "parity fail data={data:#x}");
            assert_eq!(cw >> 31, 1, "flag must be 1 for message");
        }
    }
}
