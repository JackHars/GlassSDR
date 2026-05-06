//! CW keyer: generate IQ samples from keying events with shaped rise/fall.

use num_complex::Complex32;
use std::f32::consts::PI;

/// Generate CW IQ samples from keying events.
/// - `keying`: slice of `(key_down, duration_samples)` pairs
/// - `tone_hz`: CW tone frequency in Hz
/// - `sample_rate`: sample rate in Hz
///
/// Applies a 5 ms cosine-shaped envelope on key-up and key-down edges to
/// reduce keying clicks.
pub fn cw_generate(
    keying: &[(bool, usize)],
    tone_hz: f32,
    sample_rate: f32,
) -> Vec<Complex32> {
    let mut iq = Vec::new();
    let mut phase = 0.0f32;
    let inc = 2.0 * PI * tone_hz / sample_rate;
    let rise = (sample_rate * 0.005) as usize; // 5 ms rise/fall

    for &(key, dur) in keying {
        for i in 0..dur {
            let env = if key {
                if i < rise {
                    i as f32 / rise as f32
                } else if i >= dur.saturating_sub(rise) {
                    (dur - i) as f32 / rise as f32
                } else {
                    1.0
                }
            } else {
                0.0
            };
            iq.push(Complex32::new(phase.cos(), phase.sin()) * env);
            phase += inc;
            if phase > PI {
                phase -= 2.0 * PI;
            }
        }
    }
    iq
}
