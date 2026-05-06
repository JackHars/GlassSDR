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

mod encoder {
    use mayhem_protocols::pocsag::encoder::{encode_pocsag, MessageType, PocsagMessage};

    #[test]
    fn preamble_is_576_alternating() {
        let msg = PocsagMessage { ric: 0, function: 0, content: MessageType::ToneOnly, baud_rate: 512 };
        let bits = encode_pocsag(&msg);
        assert!(bits.len() >= 576);
        for i in 0..576 {
            assert_eq!(bits[i], i % 2 == 0, "preamble bit {i}");
        }
    }

    #[test]
    fn sync_after_preamble() {
        let msg = PocsagMessage { ric: 0, function: 0, content: MessageType::ToneOnly, baud_rate: 512 };
        let bits = encode_pocsag(&msg);
        let sync = bits_to_u32(&bits[576..608]);
        assert_eq!(sync, 0x7CD215D8);
    }

    #[test]
    fn tone_only_one_batch() {
        let msg = PocsagMessage { ric: 0, function: 0, content: MessageType::ToneOnly, baud_rate: 512 };
        let bits = encode_pocsag(&msg);
        // 576 preamble + 32 sync + 16*32 codewords = 1120
        assert_eq!(bits.len(), 1120);
    }

    #[test]
    fn address_at_correct_frame_position() {
        // RIC=4 → frame position = 4%8 = 4, slot = 4*2 = 8
        let msg = PocsagMessage { ric: 4, function: 0, content: MessageType::ToneOnly, baud_rate: 512 };
        let bits = encode_pocsag(&msg);
        // Slots 0-7 should be idle, slot 8 should be the address
        let slot8_start = 576 + 32 + 8 * 32; // preamble + sync + 8 codewords
        let slot8 = bits_to_u32(&bits[slot8_start..slot8_start + 32]);
        // Address codeword has flag=0 (bit 31)
        assert_eq!(slot8 >> 31, 0);
        // Slots 0-7 should be idle
        for s in 0..8 {
            let start = 576 + 32 + s * 32;
            let cw = bits_to_u32(&bits[start..start + 32]);
            assert_eq!(cw, 0x7A89C197, "slot {s} should be idle");
        }
    }

    #[test]
    fn multi_batch_long_message() {
        // 50 alpha chars = 350 bits = 18 message codewords. RIC frame pos 7 → starts at slot 14.
        // Batch 1: slots 14,15 = 2 codewords (1 addr + 1 msg). Remaining: 17 msg cws.
        // Batch 2: 16 msg cws. Remaining: 1.
        // Batch 3: 1 msg cw + 15 idle.
        let msg = PocsagMessage {
            ric: 7, function: 0,
            content: MessageType::Alphanumeric("A".repeat(50)),
            baud_rate: 512,
        };
        let bits = encode_pocsag(&msg);
        let payload = bits.len() - 576;
        // Each batch = 32 sync + 512 codewords = 544
        assert_eq!(payload % 544, 0);
        let num_batches = payload / 544;
        assert!(num_batches >= 2, "expected at least 2 batches, got {num_batches}");
    }

    fn bits_to_u32(bits: &[bool]) -> u32 {
        assert!(bits.len() >= 32);
        let mut val = 0u32;
        for i in 0..32 {
            if bits[i] { val |= 1 << (31 - i); }
        }
        val
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
