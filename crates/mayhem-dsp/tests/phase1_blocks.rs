//! Smoke tests for Phase 1 DSP blocks: AM demod, SSB demod, audio bandpass, stereo decoder.
//! Verify each block processes synthetic data without panicking and produces reasonable output.

use num_complex::Complex32;
use std::f32::consts::PI;

#[test]
fn am_demod_processes_modulated_signal() {
    use mayhem_dsp::demod_am::AmDemod;

    let mut demod = AmDemod::new(0.5);
    let sr = 48000.0f32;
    // AM signal: carrier + 1kHz modulation
    let input: Vec<Complex32> = (0..9600)
        .map(|i| {
            let t = i as f32 / sr;
            let env = 1.0 + 0.8 * (2.0 * PI * 1000.0 * t).sin();
            Complex32::from_polar(env, 2.0 * PI * 5000.0 * t)
        })
        .collect();

    let mut out = Vec::new();
    demod.process(&input, &mut out);
    assert_eq!(out.len(), 9600);
    // Output should have variation (not all zero)
    let max = out.iter().cloned().fold(0.0f32, f32::max);
    let min = out.iter().cloned().fold(0.0f32, f32::min);
    assert!(max - min > 0.01, "AM demod output should have variation");
}

#[test]
fn ssb_demod_usb_processes() {
    use mayhem_dsp::demod_ssb::{SsbDemod, Sideband};

    let mut demod = SsbDemod::new(Sideband::Upper, 1500.0, 2700.0, 48000.0);
    // USB signal: tone at +1500 Hz
    let sr = 48000.0;
    let input: Vec<Complex32> = (0..4800)
        .map(|i| Complex32::from_polar(1.0, 2.0 * PI * 1500.0 * i as f32 / sr))
        .collect();

    let mut out = Vec::new();
    demod.process(&input, &mut out);
    assert_eq!(out.len(), 4800);
}

#[test]
fn ssb_demod_lsb_processes() {
    use mayhem_dsp::demod_ssb::{SsbDemod, Sideband};

    let mut demod = SsbDemod::new(Sideband::Lower, 1500.0, 2700.0, 48000.0);
    let input = vec![Complex32::new(0.5, 0.3); 1000];
    let mut out = Vec::new();
    demod.process(&input, &mut out);
    assert_eq!(out.len(), 1000);
}

#[test]
fn audio_bandpass_passes_center() {
    use mayhem_dsp::audio_filter::AudioBandpass;

    let mut filt = AudioBandpass::new(300.0, 3000.0, 48000.0);
    let sr = 48000.0;
    // 1 kHz tone (in passband)
    let input: Vec<f32> = (0..4800)
        .map(|i| (2.0 * PI * 1000.0 * i as f32 / sr).sin())
        .collect();

    let mut out = Vec::new();
    filt.process(&input, &mut out);
    assert_eq!(out.len(), 4800);

    // Tail should have significant energy
    let power: f32 = out[2000..].iter().map(|x| x * x).sum::<f32>() / 2800.0;
    assert!(power > 0.1, "1 kHz should pass through 300-3000 Hz filter, power={power}");
}

#[test]
fn audio_bandpass_rejects_out_of_band() {
    use mayhem_dsp::audio_filter::AudioBandpass;

    let mut filt = AudioBandpass::cw(48000.0); // 400-800 Hz
    let sr = 48000.0;
    // 5 kHz tone (out of band)
    let input: Vec<f32> = (0..4800)
        .map(|i| (2.0 * PI * 5000.0 * i as f32 / sr).sin())
        .collect();

    let mut out = Vec::new();
    filt.process(&input, &mut out);
    let power: f32 = out[2000..].iter().map(|x| x * x).sum::<f32>() / 2800.0;
    assert!(power < 0.05, "5 kHz should be rejected by 400-800 Hz CW filter, power={power}");
}

#[test]
fn stereo_decoder_output_length() {
    use mayhem_dsp::stereo_decode::StereoDecoder;

    let mut dec = StereoDecoder::new(240000.0);
    let input = vec![0.1f32; 1000];
    let mut out = Vec::new();
    dec.process(&input, &mut out);
    assert_eq!(out.len(), 2000); // stereo = 2× input
}

#[test]
fn stereo_decoder_processes_composite() {
    use mayhem_dsp::stereo_decode::StereoDecoder;

    let sr = 240000.0;
    let mut dec = StereoDecoder::new(sr);
    // Simulate composite: mono 1 kHz + 19 kHz pilot
    let input: Vec<f32> = (0..24000)
        .map(|i| {
            let t = i as f32 / sr;
            let mono = 0.5 * (2.0 * PI * 1000.0 * t).sin();
            let pilot = 0.1 * (2.0 * PI * 19000.0 * t).sin();
            mono + pilot
        })
        .collect();

    let mut out = Vec::new();
    dec.process(&input, &mut out);
    assert_eq!(out.len(), 48000);
    // Should not be all zeros
    let max = out.iter().cloned().fold(0.0f32, f32::max);
    assert!(max > 0.01, "stereo output should have content");
}
