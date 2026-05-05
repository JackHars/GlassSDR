//! AppRunner — a single-tenant manager of which app is currently running.
//! v0.1 supports one app at a time. Switching apps stops the current one cleanly.

use anyhow::Result;
use mayhem_apps::{nfm_audio::NfmAudioApp, App, AppRegistry, RunningApp};
use mayhem_ipc::{AppId, AppMetadata, AppStatus, AudioFrame, SpectrumFrame};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

pub struct AppRunner {
    registry: AppRegistry,
    state: Mutex<RunnerState>,
}

struct RunnerState {
    current: Option<(AppId, RunningApp)>,
}

impl AppRunner {
    pub fn new() -> Self {
        let mut registry = AppRegistry::new();
        registry.register(NfmAudioApp::metadata(), || {
            // Each registration produces a fresh app instance; the channel receivers
            // returned by `new()` are discarded here because the registry's instantiate()
            // path doesn't need them — runtime channels are owned by the actual `start_app`
            // path in `AppRunner::start`.
            let (app, _, _) = NfmAudioApp::new();
            app
        });
        Self {
            registry,
            state: Mutex::new(RunnerState { current: None }),
        }
    }

    pub fn list(&self) -> Vec<AppMetadata> {
        self.registry.list()
    }

    pub async fn start(self: &Arc<Self>, handle: AppHandle, id: AppId, params: Value) -> Result<()> {
        let mut state = self.state.lock().await;
        if let Some((cur_id, app)) = state.current.take() {
            tracing::info!(?cur_id, "stopping current app before switching");
            let _ = app.stop.send(());
        }

        let _ = handle.emit("app_status", AppStatus::Starting { app: id });

        // TODO(v0.2): When Plan 2 adds ADS-B, generalize this match into a per-app
        // start trampoline. The registry's `instantiate()` path can't return the
        // app's channel receivers because `Box<dyn App>` erases concrete types;
        // extend the App trait with a `start_with_channels` typed wrapper, or move
        // channel ownership into the App trait itself.

        // For NFM specifically: instantiate, take its channels, spawn pumps that re-emit as Tauri events.
        match id {
            AppId::NfmAudio => {
                let (app, audio_rx, spec_rx) = NfmAudioApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
        }

        let _ = handle.emit("app_status", AppStatus::Running { app: id });
        Ok(())
    }

    pub async fn stop(&self, handle: AppHandle) -> Result<()> {
        let mut state = self.state.lock().await;
        if let Some((id, app)) = state.current.take() {
            let _ = handle.emit("app_status", AppStatus::Stopping);
            let _ = app.stop.send(());
            tracing::info!(?id, "stop signal sent");
        }
        let _ = handle.emit("app_status", AppStatus::Idle);
        Ok(())
    }
}

fn spawn_event_pumps(
    handle: AppHandle,
    mut audio_rx: mpsc::UnboundedReceiver<AudioFrame>,
    mut spec_rx: mpsc::UnboundedReceiver<SpectrumFrame>,
) {
    let h1 = handle.clone();
    tokio::spawn(async move {
        while let Some(frame) = audio_rx.recv().await {
            let _ = h1.emit("audio", frame);
        }
    });
    let h2 = handle.clone();
    tokio::spawn(async move {
        while let Some(frame) = spec_rx.recv().await {
            let _ = h2.emit("spectrum", frame);
        }
    });
}
