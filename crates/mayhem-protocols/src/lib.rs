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
pub mod baudot;
pub mod morse;
pub mod sstv;
pub mod adsb_tx;
pub mod gps;
pub mod mdc1200;
pub mod ble;
pub mod flipper;
pub mod keyfob;
pub mod lge;
pub mod nrf24;
pub mod rfm69;
pub mod dmr;
pub mod dpmr;
pub mod nxdn;
pub mod p25;
pub mod tetra;
