use std::time::Duration;
use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize, Clone)]
struct SpectrumFrame {
    seq: u64,
    data: Vec<u8>,
}

#[derive(Serialize, Clone)]
struct AudioFrame {
    seq: u64,
    samples: Vec<i16>,
}

#[tauri::command]
fn start_stream(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut spec_seq: u64 = 0;
        let mut audio_seq: u64 = 0;
        let mut spec_interval = tokio::time::interval(Duration::from_millis(33)); // ~30 fps
        let mut audio_interval = tokio::time::interval(Duration::from_millis(20)); // 50 Hz / 20 ms
        loop {
            tokio::select! {
                _ = spec_interval.tick() => {
                    let frame = SpectrumFrame { seq: spec_seq, data: vec![0u8; 1024] };
                    spec_seq += 1;
                    let _ = app.emit("spectrum", frame);
                }
                _ = audio_interval.tick() => {
                    let frame = AudioFrame { seq: audio_seq, samples: vec![0i16; 960] };
                    audio_seq += 1;
                    let _ = app.emit("audio", frame);
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_stream])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
