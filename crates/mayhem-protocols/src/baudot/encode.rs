//! Baudot/ITA2 encoder: text → 5-bit Baudot chars with LTRS/FIGS shift, then to NRZ bits.

#[derive(Debug, Clone, Copy)]
pub struct BaudotChar {
    pub bits: [bool; 5],
}

/// Encode a text string to a sequence of Baudot characters (ITA2).
/// Inserts FIGS (0x1B) and LTRS (0x1F) shift characters as needed.
pub fn encode_baudot(text: &str) -> Vec<BaudotChar> {
    let mut out = Vec::new();
    let mut in_figs = false;
    for ch in text.chars().flat_map(|c| c.to_uppercase()) {
        let (code, needs_figs) = match ch {
            'A' => (0x03, false), 'B' => (0x19, false), 'C' => (0x0E, false),
            'D' => (0x09, false), 'E' => (0x01, false), 'F' => (0x0D, false),
            'G' => (0x1A, false), 'H' => (0x14, false), 'I' => (0x06, false),
            'J' => (0x0B, false), 'K' => (0x0F, false), 'L' => (0x12, false),
            'M' => (0x1C, false), 'N' => (0x0C, false), 'O' => (0x18, false),
            'P' => (0x16, false), 'Q' => (0x17, false), 'R' => (0x0A, false),
            'S' => (0x05, false), 'T' => (0x10, false), 'U' => (0x07, false),
            'V' => (0x1E, false), 'W' => (0x13, false), 'X' => (0x1D, false),
            'Y' => (0x15, false), 'Z' => (0x11, false),
            '1' => (0x17, true), '2' => (0x13, true), '3' => (0x01, true),
            '4' => (0x0A, true), '5' => (0x10, true), '6' => (0x15, true),
            '7' => (0x07, true), '8' => (0x06, true), '9' => (0x18, true),
            '0' => (0x16, true),
            ' ' => (0x04, false), // space is same in both shifts
            '\n' => (0x02, false),
            '\r' => (0x08, false),
            _ => continue,
        };
        if needs_figs && !in_figs {
            out.push(BaudotChar { bits: to_bits(0x1B) }); // FIGS shift
            in_figs = true;
        }
        if !needs_figs && in_figs && ch != ' ' {
            out.push(BaudotChar { bits: to_bits(0x1F) }); // LTRS shift
            in_figs = false;
        }
        out.push(BaudotChar { bits: to_bits(code) });
    }
    out
}

/// Convert Baudot chars to NRZ bit stream.
/// Each character: start bit (false/space) + 5 data bits + stop bit (true/mark) + extra half-stop.
pub fn baudot_to_nrz(chars: &[BaudotChar]) -> Vec<bool> {
    let mut bits = Vec::new();
    for ch in chars {
        bits.push(false); // start bit (space)
        for &b in &ch.bits {
            bits.push(b);
        }
        bits.push(true); // stop bit (mark)
        bits.push(true); // 1.5 stop → extra half
    }
    bits
}

fn to_bits(code: u8) -> [bool; 5] {
    let mut b = [false; 5];
    for i in 0..5 {
        b[i] = (code >> i) & 1 == 1;
    }
    b
}
