use mayhem_protocols::rds::decode::RdsStation;
use mayhem_protocols::rds::group::RdsGroup;

#[test]
fn ps_name_assembly() {
    let mut station = RdsStation::new();
    let segments = [("BB", 0u16), ("C ", 1), ("R4", 2), ("  ", 3)];
    for (chars, seg) in segments {
        let c1 = chars.as_bytes()[0] as u16;
        let c2 = chars.as_bytes()[1] as u16;
        station.process_group(&RdsGroup {
            block_a: 0xC201,
            block_b: 0x0000 | seg,
            block_c: 0x0000,
            block_d: (c1 << 8) | c2,
        });
    }
    assert_eq!(station.ps_string(), "BBC R4");
}

#[test]
fn radio_text_assembly() {
    let mut station = RdsStation::new();
    // Send "HELLO WORLD!    " in segments (4 chars each)
    let text = "HELL";
    let c = text.as_bytes();
    station.process_group(&RdsGroup {
        block_a: 0xC201,
        block_b: 0x2000, // type 2, segment 0
        block_c: ((c[0] as u16) << 8) | c[1] as u16,
        block_d: ((c[2] as u16) << 8) | c[3] as u16,
    });
    assert_eq!(&station.rt_string()[..4], "HELL");
}

#[test]
fn pty_extraction() {
    let mut station = RdsStation::new();
    // PTY = 10 (0b01010) at bits 9..5 of block_b
    station.process_group(&RdsGroup {
        block_a: 0xC201,
        block_b: 0x0000 | (10 << 5),
        block_c: 0,
        block_d: 0x4120, // "A "
    });
    assert_eq!(station.pty, 10);
}
