//! AX.25 protocol decoder and encoder: NRZI, HDLC, frame parsing/building.

pub mod frame;
pub mod encode;
pub use frame::{Ax25Frame, Callsign, decode_ax25, hdlc_unstuff, nrzi_decode};
