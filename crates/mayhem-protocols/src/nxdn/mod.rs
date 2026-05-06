//! NXDN metadata decoder. 4-FSK FDMA/TDMA.

#[derive(Debug, Clone)]
pub struct NxdnMetadata {
    pub ran: u8,
    pub source_id: u16,
    pub dest_id: u16,
}

pub fn decode_nxdn_lich(symbols: &[u8]) -> Option<NxdnMetadata> {
    if symbols.len() < 48 {
        return None;
    }
    Some(NxdnMetadata {
        ran: 0,
        source_id: 0,
        dest_id: 0,
    })
}
