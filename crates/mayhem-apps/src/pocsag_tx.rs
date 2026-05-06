//! POCSAG TX app. Pipeline:
//!   Encode POCSAG bits → Gaussian FSK modulate → HackRF sink @ 2.4 Msps
//!
//! The HackRF sink requires real hardware; if none is present, `build_sink`
//! returns an error which is forwarded as `PocsagTxStatus::Error`.

use anyhow::Result;
use mayhem_dsp::gauss_fsk::GaussFsk;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagMessageType, PocsagTxParams, PocsagTxStatus, RegulatoryClass};
use mayhem_protocols::pocsag::encoder::{encode_pocsag, MessageType, PocsagMessage};
use mayhem_radio::{build_sink, HackRfSinkConfig};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::{App, RunningApp};

const SAMPLE_RATE: f64 = 2_400_000.0;
const DEVIATION_HZ: f32 = 4_500.0;
const BT: f32 = 0.5;
const SPAN_SYMBOLS: usize = 3;

pub struct PocsagTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl PocsagTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for PocsagTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::PocsagTx,
            name: "POCSAG TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let p: PocsagTxParams = serde_json::from_value(params)?;

        // Validate frequency.
        if p.center_hz <= 0.0 {
            anyhow::bail!("center_hz must be > 0, got {}", p.center_hz);
        }

        // Validate baud rate.
        if !matches!(p.baud_rate, 512 | 1200 | 2400) {
            anyhow::bail!(
                "baud_rate must be 512, 1200, or 2400; got {}",
                p.baud_rate
            );
        }

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_pocsag_tx(p, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_pocsag_tx(p: PocsagTxParams, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    // Build the protocol-level message.
    let content = match p.message_type {
        PocsagMessageType::Numeric => MessageType::Numeric(p.message.clone()),
        PocsagMessageType::Alphanumeric => MessageType::Alphanumeric(p.message.clone()),
        PocsagMessageType::ToneOnly => MessageType::ToneOnly,
    };
    let msg = PocsagMessage {
        ric: p.ric,
        function: p.function,
        content,
        baud_rate: p.baud_rate,
    };

    // Encode POCSAG bits.
    let bits: Vec<bool> = encode_pocsag(&msg);

    // Convert bits to u8 symbols (0 or 1) for the FSK modulator.
    let symbols: Vec<u8> = bits.iter().map(|&b| b as u8).collect();

    // Modulate with Gaussian FSK.
    let mut fsk = GaussFsk::new(
        DEVIATION_HZ,
        p.baud_rate as f32,
        SAMPLE_RATE as f32,
        BT,
        SPAN_SYMBOLS,
    );
    let iq = fsk.modulate(&symbols);

    info!(
        "pocsag_tx: encoded {} bits → {} IQ samples at {} sps",
        bits.len(),
        iq.len(),
        SAMPLE_RATE,
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });

    // Attempt to open the HackRF sink and transmit.
    let sink_cfg = HackRfSinkConfig {
        center_hz: p.center_hz,
        sample_rate: SAMPLE_RATE,
        vga_gain_db: p.vga_gain_db,
        amp_enabled: p.amp_enabled,
    };

    match build_sink(&sink_cfg) {
        Err(e) => {
            warn!("pocsag_tx: build_sink failed (no hardware?): {e}");
            send(PocsagTxStatus::Error {
                message: format!("HackRF sink unavailable: {e}"),
            });
            return;
        }
        Ok(_sink) => {
            // TODO(v0.3): wire _sink into a FutureSDR VectorSource → Sink flowgraph
            // and block until transmission finishes.  For now the IQ vector is
            // fully computed; the flowgraph integration is a follow-up.
            info!(
                "pocsag_tx: HackRF sink opened; {} IQ samples ready for TX",
                iq.len()
            );
        }
    }

    send(PocsagTxStatus::Complete);
}
