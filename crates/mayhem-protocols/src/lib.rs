//! Pure-function protocol codecs. Bytes/symbols in, decoded structs out.
//! No DSP, no I/O, no flowgraph — fully testable with byte fixtures.

pub mod acars;
pub mod adsb;
pub mod ais;
pub mod aprs;
pub mod ax25;
pub mod ert;
pub mod flex;
pub mod pocsag;
pub mod rds;
pub mod sonde;
pub mod ook;
pub mod weather;
pub mod apt;
pub mod dab;
pub mod dsc;
pub mod epirb;
