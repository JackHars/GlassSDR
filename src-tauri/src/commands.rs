use crate::runner::AppRunner;
use mayhem_ipc::{AppId, AppMetadata};
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Session-scoped TX arm state. Managed by Tauri.
pub struct TxArmState {
    /// Whether the user has acknowledged the legal banner this session.
    pub legal_accepted: AtomicBool,
    /// Whether TX is currently armed (ready to transmit).
    pub armed: AtomicBool,
}

impl TxArmState {
    pub fn new() -> Self {
        Self {
            legal_accepted: AtomicBool::new(false),
            armed: AtomicBool::new(false),
        }
    }
}

#[tauri::command]
pub fn list_apps(runner: State<'_, Arc<AppRunner>>) -> Vec<AppMetadata> {
    runner.list()
}

#[tauri::command]
pub async fn start_app(
    handle: AppHandle,
    runner: State<'_, Arc<AppRunner>>,
    id: AppId,
    params: Value,
) -> Result<(), String> {
    runner
        .start(handle, id, params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_app(handle: AppHandle, runner: State<'_, Arc<AppRunner>>) -> Result<(), String> {
    runner.stop(handle).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn accept_tx_legal(
    tx_state: State<'_, TxArmState>,
) -> Result<(), String> {
    tx_state.legal_accepted.store(true, Ordering::Release);
    Ok(())
}

#[tauri::command]
pub async fn arm_tx(
    tx_state: State<'_, TxArmState>,
) -> Result<(), String> {
    if !tx_state.legal_accepted.load(Ordering::Acquire) {
        return Err("Legal notice must be accepted before arming TX".into());
    }
    tx_state.armed.store(true, Ordering::Release);
    Ok(())
}

#[tauri::command]
pub async fn disarm_tx(
    tx_state: State<'_, TxArmState>,
) -> Result<(), String> {
    tx_state.armed.store(false, Ordering::Release);
    Ok(())
}
