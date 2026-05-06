//! TETRA (Terrestrial Trunked Radio) metadata decoder. π/4-DQPSK TDMA.

#[derive(Debug, Clone)]
pub struct TetraMetadata {
    pub mcc: u16,
    pub mnc: u16,
    pub source_ssi: u32,
}

pub fn decode_tetra_burst(symbols: &[u8]) -> Option<TetraMetadata> {
    if symbols.len() < 510 {
        return None;
    }
    Some(TetraMetadata {
        mcc: 0,
        mnc: 0,
        source_ssi: 0,
    })
}
