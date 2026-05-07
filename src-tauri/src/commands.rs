use crate::runner::AppRunner;
use mayhem_ipc::{AppId, AppMetadata};
use mayhem_recorder::{ActiveRecording, RecordingFormat, RecordingMeta, RecordingStatus};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

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

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::PathBuf::from(&path);
    if !dir.is_dir() { return Err(format!("Not a directory: {path}")); }
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size_bytes: meta.len(),
        });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

// Apple vendor IDs to filter out
const APPLE_VENDOR_IDS: &[u16] = &[0x05AC, 0x004C];

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsbDevice {
    pub id: String,
    pub name: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub is_hackrf: bool,
}

fn recordings_root(handle: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    Ok(data_dir.join("recordings"))
}

#[tauri::command]
pub async fn start_recording(
    handle: AppHandle,
    runner: State<'_, Arc<AppRunner>>,
    app_id: AppId,
    format: RecordingFormat,
    center_hz: Option<f64>,
) -> Result<String, String> {
    let root = recordings_root(&handle)?;
    let active = ActiveRecording::new(app_id, format, &root, center_hz)
        .map_err(|e| e.to_string())?;
    let id = active.id.clone();
    {
        let mut guard = runner.recording.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("a recording is already in progress".into());
        }
        *guard = Some(active);
    }

    // Spawn a status emitter that ticks once per second.
    let rec = runner.recording.clone();
    let h = handle.clone();
    let id_for_task = id.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let snapshot = if let Ok(g) = rec.lock() {
                if let Some(active) = g.as_ref() {
                    if active.id == id_for_task {
                        Some(RecordingStatus {
                            id: active.id.clone(),
                            elapsed_ms: active.elapsed_ms(),
                            bytes_written: active.bytes_written() as f64,
                        })
                    } else { None }
                } else { None }
            } else { None };
            match snapshot {
                Some(s) => { let _ = h.emit("recording_status", s); }
                None => break,
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn stop_recording(
    runner: State<'_, Arc<AppRunner>>,
) -> Result<RecordingMeta, String> {
    let active = {
        let mut guard = runner.recording.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    let active = active.ok_or_else(|| "no active recording".to_string())?;
    active.finish().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_recordings(
    handle: AppHandle,
    app_id: Option<AppId>,
) -> Result<Vec<RecordingMeta>, String> {
    let root = recordings_root(&handle)?;
    mayhem_recorder::list_recordings(&root, app_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_recording(path: String) -> Result<(), String> {
    mayhem_recorder::delete_recording(std::path::Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_usb_devices() -> Result<Vec<UsbDevice>, String> {
    let devices = rusb::devices().map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for device in devices.iter() {
        let desc = device.device_descriptor().map_err(|e| e.to_string())?;
        let vid = desc.vendor_id();
        let pid = desc.product_id();

        // Skip Apple peripherals
        if APPLE_VENDOR_IDS.contains(&vid) {
            continue;
        }
        // Skip USB hubs (class 9)
        if desc.class_code() == 9 {
            continue;
        }

        let handle = device.open().ok();
        let manufacturer = handle.as_ref()
            .and_then(|h| h.read_manufacturer_string_ascii(&desc).ok())
            .unwrap_or_default();
        let product = handle.as_ref()
            .and_then(|h| h.read_product_string_ascii(&desc).ok())
            .unwrap_or_default();

        // HackRF: VID 0x1D50, PID 0x6089
        let is_hackrf = vid == 0x1D50 && pid == 0x6089;

        let name = if !product.is_empty() {
            if !manufacturer.is_empty() {
                format!("{} {}", manufacturer, product)
            } else {
                product
            }
        } else if is_hackrf {
            "HackRF One".to_string()
        } else {
            format!("USB Device {:04x}:{:04x}", vid, pid)
        };

        result.push(UsbDevice {
            id: format!("{:04x}:{:04x}", vid, pid),
            name,
            vendor_id: vid,
            product_id: pid,
            is_hackrf,
        });
    }

    // Sort HackRF devices first
    result.sort_by(|a, b| b.is_hackrf.cmp(&a.is_hackrf));
    Ok(result)
}
