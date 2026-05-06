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
        ])
        .setup(|app| {
            app.get_webview_window("main")
                .expect("main window")
                .set_title("Mayhem PC")
                .ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
