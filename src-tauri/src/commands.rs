use crate::runner::AppRunner;
use mayhem_ipc::{AppId, AppMetadata};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

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
