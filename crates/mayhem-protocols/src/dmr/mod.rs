//! DMR (Digital Mobile Radio) metadata decoder. 4-FSK TDMA.

#[derive(Debug, Clone)]
pub struct DmrMetadata {
    pub slot: u8,
    pub color_code: u8,
    pub talkgroup: u32,
    pub source_id: u32,
    pub call_type: DmrCallType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DmrCallType {
    Group,
    Private,
    AllCall,
}

/// Decode DMR burst from 4-FSK symbols (264 symbols per burst). Returns metadata stub.
pub fn decode_dmr_burst(symbols: &[u8]) -> Option<DmrMetadata> {
    if symbols.len() < 264 {
        return None;
    }
    let slot = if symbols[0] & 1 == 0 { 1 } else { 2 };
    let color_code = symbols[1] & 0x0F;
    Some(DmrMetadata {
        slot,
        color_code,
        talkgroup: 0,
        source_id: 0,
        call_type: DmrCallType::Group,
    })
}
