# Record Button + Waterfall Pass — Design

Date: 2026-05-06
Author: brainstormed in session

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Which apps get the waterfall? | Audio-style RX only. Add to `am-rx`, `ssb-rx`, `cw-rx` (the three audio receivers that lack it; `nfm-audio` and `wfm-rx` already have it). |
| 2 | Which apps get a record button? | All RX + all TX apps. Pure utilities (calculator, snake, doom, notepad, settings, file-manager, freq-manager, band-plan, antenna-calc, morse-trainer, playlist) are excluded. |
| 3 | Implementation depth? | Real, shared per-format recorders — one each for WAV / JSONL / IQ / IMG. No fake button. |
| 4 | Recording discovery? | Per-app inline history panel under each app's controls. Recordings save to a single on-disk tree (`<app-data>/recordings/<app_id>/<timestamp>.<ext>`). A central "Recordings" view groups across apps by source app. |
| 5 | Image-producing apps (apt-rx, hrpt-rx, lrpt-rx)? | New `IMG` recorder type — saves the decoded PNG. |

## Architecture

### `mayhem-recorder` crate

Provides four recorder types. Each writes to a session-scoped file and exposes `write_*` for the relevant frame.

| Type | Input | Output extension | Notes |
|---|---|---|---|
| `WavRecorder` | `AudioFrame` (i16 mono 48 kHz) | `.wav` | Streams a RIFF header up front, patches sizes on close. |
| `JsonlRecorder` | any serde-serializable event | `.jsonl` | One JSON object per line, includes server-side timestamp. |
| `IqRecorder` | raw IQ bytes from the source | `.cs8` + `.json` sidecar | HackRF native cs8 + sidecar with sample rate / center freq / start time. |
| `ImgRecorder` | decoded image frames | `.png` | Per image; index sidecar lists multiple images per session. |

### Active recording session

`RecordingState` (a `Mutex<Option<ActiveRecording>>`) is owned by the Tauri runtime. Pumps in `runner.rs` check this state on every frame; if recording is active and matches the recorder type, the frame is also written. The IPC commands `start_recording` / `stop_recording` swap this state.

### IPC

- `start_recording(app_id: AppId, format: RecordingFormat) -> RecordingId`
- `stop_recording() -> RecordingMeta` (path + duration + bytes)
- `list_recordings(app_id?: AppId) -> Vec<RecordingMeta>` — scans the recordings dir, returns metadata sorted by mtime.
- Event `recording_status` emitted while active: `{ id, elapsed_ms, bytes_written }`.

### App-to-recorder mapping

| Recorder | Apps |
|---|---|
| WAV | nfm-audio, wfm-rx, am-rx, ssb-rx (USB+LSB), cw-rx |
| JSONL | rds-rx, aprs-rx, ais-rx, acars-rx, pocsag-rx, afsk-rx, ert-rx, weather-rx, sonde-rx, sonde-rx-ext, twotone-rx, flex-rx, tpms-rx, ook-analyzer, ook-decoders, scanner, recon, looking-glass, dsc-rx, epirb-rx, dab-rx, adsb-rx, adsb-ext, btle-rx, btle-comm, nrf24-rx, dmr-rx, dpmr-rx, p25-rx, nxdn-rx, tetra-rx, pager-agg, freq-counter, ctcss-dcs, signal-meter, sub-ghz-capture, decoder-suite |
| IQ | iq-player, sdr-bench, protocol-analyzer, remote-control, rf-char, capture-manager, all TX apps |
| IMG | apt-rx, hrpt-rx, lrpt-rx |

### Frontend

- `RecordButton` — circle dot, idle/recording states, timer. Calls IPC.
- `RecordingsPanel` — collapsible list under each app showing past recordings of that app (filter by `app_id`).
- `RecordingsLibraryApp` — central view (added to home grid) showing recordings grouped by source app, with play/open/delete actions.
- Waterfalls added to `am-rx`, `ssb-rx`, `cw-rx`.

### Disk layout

```
<tauri app data dir>/recordings/
  nfm_audio/
    20260506-143022.wav
  apt_rx/
    20260506-150000.png
    20260506-150000.json   # metadata sidecar
  pocsag_tx/
    20260506-160000.cs8
    20260506-160000.json
```

### Phasing

1. Crate + recorder types (file-write level, isolated).
2. IPC commands + runner integration.
3. Frontend RecordButton + RecordingsPanel.
4. Wire into apps (mechanical, ~50 files).
5. Waterfalls for am/ssb/cw.
6. Central Recordings library view.
