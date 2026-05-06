//! DAB Fast Information Channel (FIC) decoder.
//! Parses FIBs (Fast Information Blocks) to extract ensemble and service info.

#[derive(Debug, Clone, Default)]
pub struct DabEnsemble {
    pub eid: u16,
    pub label: String,
    pub services: Vec<DabService>,
}

#[derive(Debug, Clone)]
pub struct DabService {
    pub sid: u32,
    pub label: String,
    pub pty: u8,
}

/// Decode a collection of FIC blocks into a DAB ensemble description.
pub fn decode_fic(fic_blocks: &[&[u8]]) -> DabEnsemble {
    let mut ensemble = DabEnsemble::default();
    for block in fic_blocks {
        if block.len() >= 3 {
            parse_fib(block, &mut ensemble);
        }
    }
    ensemble
}

fn parse_fib(fib: &[u8], ensemble: &mut DabEnsemble) {
    let mut offset = 0;
    while offset + 1 < fib.len() {
        let fig_type = (fib[offset] >> 5) & 0x07;
        let fig_len = (fib[offset] & 0x1F) as usize;
        offset += 1;
        if offset + fig_len > fib.len() || fig_type == 7 {
            break;
        }
        if fig_type == 0 && fig_len >= 4 {
            ensemble.eid = u16::from_be_bytes([fib[offset], fib[offset + 1]]);
        }
        offset += fig_len;
    }
}
