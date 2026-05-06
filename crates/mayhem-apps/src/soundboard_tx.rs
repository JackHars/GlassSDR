//! Soundboard TX app. Transmits a pre-recorded audio clip via FM + HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct SoundboardTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl SoundboardTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for SoundboardTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SoundboardTx,
            name: "Soundboard TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let clip_id = params
            .get("clip_id")
            .and_then(|v| v.as_str())
            .unwrap_or("default")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_soundboard_tx(clip_id, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_soundboard_tx(clip_id: String, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    // Placeholder: generate a short silent audio clip
    let sample_rate = 48_000.0f32;
    let duration_s = 1.0f32;
    let audio = vec![0.0f32; (sample_rate * duration_s) as usize];

    use mayhem_dsp::fm_mod::fm_modulate;
    let iq = fm_modulate(&audio, 5_000.0, sample_rate);

    info!("soundboard_tx: clip '{}' → {} IQ samples", clip_id, iq.len());

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): push IQ to HackRF sink
    send(PocsagTxStatus::Complete);
}
