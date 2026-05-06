//! AFSK modulator: binary bits → audio samples using mark/space tones.

use std::f32::consts::PI;

/// Modulate a bit stream using Audio Frequency Shift Keying.
/// - `mark_hz`: frequency for bit 1
/// - `space_hz`: frequency for bit 0
/// - `baud`: symbol rate in baud
/// - `sample_rate`: output sample rate in Hz
pub fn afsk_modulate(
    bits: &[u8],
    mark_hz: f32,
    space_hz: f32,
    baud: f32,
    sample_rate: f32,
) -> Vec<f32> {
    let sps = (sample_rate / baud).round() as usize;
    let mut audio = Vec::with_capacity(bits.len() * sps);
    let mut phase = 0.0f32;
    for &bit in bits {
        let freq = if bit == 1 { mark_hz } else { space_hz };
        let inc = 2.0 * PI * freq / sample_rate;
        for _ in 0..sps {
            audio.push(phase.sin());
            phase += inc;
            if phase > PI {
                phase -= 2.0 * PI;
            }
        }
    }
    audio
}
