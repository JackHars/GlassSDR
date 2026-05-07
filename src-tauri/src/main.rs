#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod runner;

use std::sync::Arc;
use tauri::Manager;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let runner = Arc::new(runner::AppRunner::new());

    tauri::Builder::default()
        .manage(runner)
        .manage(commands::TxArmState::new())
        .invoke_handler(tauri::generate_handler![
            commands::list_apps,
            commands::start_app,
            commands::stop_app,
            commands::accept_tx_legal,
            commands::arm_tx,
            commands::disarm_tx,
            commands::list_directory,
            commands::read_text_file,
            commands::write_text_file,
            commands::list_usb_devices,
            commands::start_recording,
            commands::stop_recording,
            commands::list_recordings,
            commands::delete_recording,
        ])
        .setup(|app| {
            app.get_webview_window("main")
                .expect("main window")
                .set_title("GlassSDR")
                .ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
