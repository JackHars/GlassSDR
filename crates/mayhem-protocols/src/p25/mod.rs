//! P25 (APCO Project 25) metadata decoder.

#[derive(Debug, Clone)]
pub struct P25Metadata {
    pub nac: u16,
    pub talkgroup: u16,
    pub source_unit: u32,
    pub duid: u8,
}

pub fn decode_p25_nid(symbols: &[u8]) -> Option<P25Metadata> {
    if symbols.len() < 64 {
        return None;
    }
    Some(P25Metadata {
        nac: 0,
        talkgroup: 0,
        source_unit: 0,
        duid: 0,
    })
}
