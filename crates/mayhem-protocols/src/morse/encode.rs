//! Morse code encoder: text → sequence of dit/dah/gap elements.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MorseElement {
    Dit,
    Dah,
    IntraGap,
    CharGap,
    WordGap,
}

/// Encode text to a sequence of Morse elements.
pub fn encode_morse(text: &str) -> Vec<MorseElement> {
    let mut out = Vec::new();
    let mut first_word = true;
    for word in text.split_whitespace() {
        if !first_word {
            out.push(MorseElement::WordGap);
        }
        let mut first_char = true;
        for ch in word.chars() {
            if !first_char {
                out.push(MorseElement::CharGap);
            }
            if let Some(pattern) = morse_lookup(ch) {
                for (i, &elem) in pattern.iter().enumerate() {
                    if i > 0 {
                        out.push(MorseElement::IntraGap);
                    }
                    out.push(elem);
                }
            }
            first_char = false;
        }
        first_word = false;
    }
    out
}

fn morse_lookup(ch: char) -> Option<&'static [MorseElement]> {
    use MorseElement::{Dit as D, Dah as T};
    match ch.to_ascii_uppercase() {
        'A' => Some(&[D, T]),
        'B' => Some(&[T, D, D, D]),
        'C' => Some(&[T, D, T, D]),
        'D' => Some(&[T, D, D]),
        'E' => Some(&[D]),
        'F' => Some(&[D, D, T, D]),
        'G' => Some(&[T, T, D]),
        'H' => Some(&[D, D, D, D]),
        'I' => Some(&[D, D]),
        'J' => Some(&[D, T, T, T]),
        'K' => Some(&[T, D, T]),
        'L' => Some(&[D, T, D, D]),
        'M' => Some(&[T, T]),
        'N' => Some(&[T, D]),
        'O' => Some(&[T, T, T]),
        'P' => Some(&[D, T, T, D]),
        'Q' => Some(&[T, T, D, T]),
        'R' => Some(&[D, T, D]),
        'S' => Some(&[D, D, D]),
        'T' => Some(&[T]),
        'U' => Some(&[D, D, T]),
        'V' => Some(&[D, D, D, T]),
        'W' => Some(&[D, T, T]),
        'X' => Some(&[T, D, D, T]),
        'Y' => Some(&[T, D, T, T]),
        'Z' => Some(&[T, T, D, D]),
        '0' => Some(&[T, T, T, T, T]),
        '1' => Some(&[D, T, T, T, T]),
        '2' => Some(&[D, D, T, T, T]),
        '3' => Some(&[D, D, D, T, T]),
        '4' => Some(&[D, D, D, D, T]),
        '5' => Some(&[D, D, D, D, D]),
        '6' => Some(&[T, D, D, D, D]),
        '7' => Some(&[T, T, D, D, D]),
        '8' => Some(&[T, T, T, D, D]),
        '9' => Some(&[T, T, T, T, D]),
        _ => None,
    }
}
