use mayhem_protocols::acars::{decode_acars, AcarsMessage};

#[test]
fn decode_basic_frame() {
    // Synthetic ACARS frame
    // mode='2', reg="G-ABCD ", ack='!', label="H1", block_id='3'
    // text: msg_no="0001" + flight="BA123 " + "HELLO WORLD" + ETX
    let mut frame: Vec<u8> = Vec::new();
    frame.push(b'2');                           // mode
    frame.extend_from_slice(b"G-ABCD ");        // reg (7 chars)
    frame.push(b'!');                           // ack
    frame.extend_from_slice(b"H1");             // label
    frame.push(b'3');                           // block_id
    frame.extend_from_slice(b"0001BA123 HELLO WORLD");  // text
    frame.push(0x03);                           // ETX

    let msg = decode_acars(&frame).expect("should decode");
    assert_eq!(msg.mode, '2');
    assert_eq!(msg.reg, "G-ABCD");
    assert_eq!(msg.ack, '!');
    assert_eq!(msg.label, "H1");
    assert_eq!(msg.block_id, '3');
    assert_eq!(msg.flight, "BA123");
    assert_eq!(msg.text, "HELLO WORLD");
}

#[test]
fn decode_too_short() {
    let frame = vec![b'2'; 5];
    assert!(decode_acars(&frame).is_none());
}

#[test]
fn decode_strips_parity_bits() {
    // High bit set (parity) should be masked off
    let mut frame: Vec<u8> = Vec::new();
    frame.push(b'2' | 0x80);                   // mode with parity
    frame.extend_from_slice(b"N12345 ");        // reg
    frame.push(b'!' | 0x80);                    // ack with parity
    frame.extend_from_slice(b"Q0");             // label
    frame.push(b'1');                           // block_id

    let msg = decode_acars(&frame).expect("should decode");
    assert_eq!(msg.mode, '2');
    assert_eq!(msg.reg, "N12345");
    assert_eq!(msg.ack, '!');
}
