//! dPMR (digital Private Mobile Radio) metadata decoder.

#[derive(Debug, Clone)]
pub struct DpmrMetadata {
    pub source_id: u32,
    pub dest_id: u32,
}

pub fn decode_dpmr_frame(symbols: &[u8]) -> Option<DpmrMetadata> {
    if symbols.len() < 120 {
        return None;
    }
    Some(DpmrMetadata {
        source_id: 0,
        dest_id: 0,
    })
}
