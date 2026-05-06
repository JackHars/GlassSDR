/// RDS CRC polynomial: x^10 + x^8 + x^7 + x^5 + x^4 + x^3 + 1
const CRC_POLY: u32 = 0x1B9;

/// Offset words for block identification
const OFFSET_A: u16 = 0x0FC;
const OFFSET_B: u16 = 0x198;
const OFFSET_C: u16 = 0x168;
const OFFSET_C_PRIME: u16 = 0x350;
const OFFSET_D: u16 = 0x1B4;

#[derive(Debug, Clone)]
pub struct RdsGroup {
    pub block_a: u16,  // PI code
    pub block_b: u16,  // Group type + flags
    pub block_c: u16,  // Data
    pub block_d: u16,  // Data
}

impl RdsGroup {
    pub fn group_type(&self) -> u8 { ((self.block_b >> 12) & 0x0F) as u8 }
    pub fn version_b(&self) -> bool { (self.block_b >> 11) & 1 == 1 }
    pub fn tp(&self) -> bool { (self.block_b >> 10) & 1 == 1 }
    pub fn pty(&self) -> u8 { ((self.block_b >> 5) & 0x1F) as u8 }
}

/// Check a 26-bit RDS block against an expected offset word.
pub fn check_block(block_26: u32, offset: u16) -> bool {
    let mut reg = block_26;
    for i in (10..26).rev() {
        if reg & (1 << i) != 0 {
            reg ^= CRC_POLY << (i - 10);
        }
    }
    (reg & 0x3FF) == offset as u32
}

/// Assemble a group from 104 bits. Returns None if CRC check fails.
pub fn assemble_group(bits: &[bool; 104]) -> Option<RdsGroup> {
    let blk_a = extract_26(bits, 0);
    let blk_b = extract_26(bits, 26);
    let blk_c = extract_26(bits, 52);
    let blk_d = extract_26(bits, 78);

    if !check_block(blk_a, OFFSET_A) { return None; }
    if !check_block(blk_b, OFFSET_B) { return None; }
    if !check_block(blk_c, OFFSET_C) && !check_block(blk_c, OFFSET_C_PRIME) { return None; }
    if !check_block(blk_d, OFFSET_D) { return None; }

    Some(RdsGroup {
        block_a: (blk_a >> 10) as u16,
        block_b: (blk_b >> 10) as u16,
        block_c: (blk_c >> 10) as u16,
        block_d: (blk_d >> 10) as u16,
    })
}

fn extract_26(bits: &[bool; 104], offset: usize) -> u32 {
    let mut val = 0u32;
    for i in 0..26 {
        if bits[offset + i] { val |= 1 << (25 - i); }
    }
    val
}
