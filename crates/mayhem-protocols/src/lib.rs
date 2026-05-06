//! Pure-function protocol codecs. Bytes/symbols in, decoded structs out.
//! No DSP, no I/O, no flowgraph — fully testable with byte fixtures.

pub mod adsb;
pub mod ais;
pub mod aprs;
pub mod ax25;
pub mod pocsag;
pub mod rds;
