//! FM modulator: audio samples → complex IQ baseband.

use num_complex::Complex32;
use std::f32::consts::PI;

/// FM-modulate an audio signal to complex baseband IQ.
/// - `deviation_hz`: peak frequency deviation in Hz
/// - `sample_rate`: sample rate in Hz
pub fn fm_modulate(audio: &[f32], deviation_hz: f32, sample_rate: f32) -> Vec<Complex32> {
    let mut iq = Vec::with_capacity(audio.len());
    let mut phase = 0.0f32;
    for &s in audio {
        phase += 2.0 * PI * deviation_hz * s / sample_rate;
        if phase > PI {
            phase -= 2.0 * PI;
        }
        if phase < -PI {
            phase += 2.0 * PI;
        }
        iq.push(Complex32::new(phase.cos(), phase.sin()));
    }
    iq
}
