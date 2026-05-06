//! Morse TX app. Encodes text to Morse and generates CW IQ via HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct MorseTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl MorseTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for MorseTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::MorseTx,
            name: "Morse TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let message = params
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let wpm = params.get("wpm").and_then(|v| v.as_f64()).unwrap_or(20.0) as f32;
        let tone_hz = params.get("tone_hz").and_then(|v| v.as_f64()).unwrap_or(700.0) as f32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_morse_tx(message, wpm, tone_hz, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_morse_tx(
    message: String,
    wpm: f32,
    tone_hz: f32,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::morse::{encode_morse, MorseElement};
    use mayhem_dsp::cw_keyer::cw_generate;

    let elements = encode_morse(&message);

    // PARIS standard: 1 dit = 1200 / wpm ms
    let sample_rate = 48_000.0f32;
    let dit_samples = (sample_rate * 1.2 / wpm) as usize;

    let mut keying: Vec<(bool, usize)> = Vec::new();
    for elem in &elements {
        match elem {
            MorseElement::Dit => {
                keying.push((true, dit_samples));
                keying.push((false, dit_samples)); // intra-element gap
            }
            MorseElement::Dah => {
                keying.push((true, dit_samples * 3));
                keying.push((false, dit_samples));
            }
            MorseElement::IntraGap => {} // already added after dit/dah
            MorseElement::CharGap => {
                keying.push((false, dit_samples * 2)); // total 3 dits (1 already added)
            }
            MorseElement::WordGap => {
                keying.push((false, dit_samples * 6)); // total 7 dits
            }
        }
    }

    let iq = cw_generate(&keying, tone_hz, sample_rate);

    info!(
        "morse_tx: '{}' → {} elements → {} IQ samples at {} wpm",
        message,
        elements.len(),
        iq.len(),
        wpm
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): push IQ to HackRF sink
    send(PocsagTxStatus::Complete);
}
