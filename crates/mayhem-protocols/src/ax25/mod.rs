//! AX.25 protocol decoder: NRZI, HDLC unstuffing, frame parsing.

pub mod frame;
pub use frame::{Ax25Frame, Callsign, decode_ax25, hdlc_unstuff, nrzi_decode};
