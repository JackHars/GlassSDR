//! Spectrum Painter app. Converts an image to IQ via IFFT and paints it on
//! the waterfall by transmitting through HackRF.
//!
//! INDOOR TEST ONLY — transmissions will appear across a wide bandwidth;
//! only operate in a shielded enclosure or Faraday cage.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct SpectrumPainterApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl SpectrumPainterApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for SpectrumPainterApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SpectrumPainter,
            name: "Spectrum Painter".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(100_000_000.0);

        FrequencyPolicy::check("spectrum_painter", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let image_path = params
            .get("image_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_spectrum_painter(image_path, freq_hz, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_spectrum_painter(
    image_path: String,
    freq_hz: f64,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Armed);
    info!(image_path = %image_path, freq_hz, "spectrum_painter: painting (stub)");

    // Load image pixels — stub uses a 64×16 black canvas.
    let width: usize = 64;
    let height: usize = 16;
    let image = vec![0u8; width * height];

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    let iq = mayhem_dsp::spectrum_paint::paint_to_iq(&image, width, height);
    info!("spectrum_painter: {} IQ samples generated", iq.len());

    // TODO(v0.3): push `iq` into HackRF sink at `freq_hz`.
    send(PocsagTxStatus::Transmitting { progress_pct: 100 });
    send(PocsagTxStatus::Complete);
}
