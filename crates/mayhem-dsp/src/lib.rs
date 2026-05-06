//! Reusable DSP blocks built on FutureSDR. Hardware- and protocol-agnostic.

pub mod afsk_demod;
pub mod fsk_slicer;
pub mod audio_filter;
pub mod decimation;
pub mod demod_am;
pub mod demod_fm;
pub mod demod_ssb;
pub mod gauss_fsk;
pub mod magnitude;
pub mod ppm;
pub mod preamble;
pub mod resample;
pub mod spectrum;
pub mod stereo_decode;
pub mod manchester;
pub mod ook_envelope;
pub mod tone_detect;
