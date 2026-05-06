# Phase 7 — Utilities & Games

**Theme:** Non-DSP apps — UI-only tools, file managers, settings, and entertainment. These require no HackRF and no radio backend. They exist because Mayhem firmware bundles them as part of the "complete device" experience; the PC port includes them for feature completeness.

**Shared building blocks:** None new. These apps use only the frontend framework (React, Zustand, Tauri file system APIs). Some may call Tauri's native file dialog or OS integration APIs.

---

## Apps

| # | App | Description | Category | Key UI Elements |
|---|-----|-------------|----------|-----------------|
| 1 | Frequency Manager | Browse, search, and manage frequency databases | File/Data | Frequency list, search/filter, categories, import/export |
| 2 | File Manager | Browse captures, recordings, and app data files | File/Data | File tree, preview pane, delete/rename/copy |
| 3 | Playlist | Sequential app execution (scan list, TX schedule) | Automation | Step list editor, play/pause/skip, loop |
| 4 | Settings | Application preferences and configuration | System | Theme, audio device, default gains, paths, about |
| 5 | Calculator | General-purpose + RF calculator (wavelength, link budget, dBm/watts) | Utility | Standard calc + RF-specific tabs |
| 6 | Notepad | Simple text editor for notes during operation | Utility | Text area, save/load, timestamp insert |
| 7 | Snake | Classic snake game | Game | Canvas game, score, speed levels |
| 8 | Doom | Doom-style game (simplified / tribute) | Game | Canvas game, keyboard controls |
| 9 | Morse Trainer | Practice sending/receiving Morse code | Training | Random text generation, speed control, score tracking |
| 10 | Band Plan Viewer | Visual display of frequency allocations by region | Reference | Zoomable band chart, region selector (ITU 1/2/3), search |
| 11 | Antenna Calculator | Calculate antenna dimensions for given frequency | Utility | Antenna type (dipole, quarter-wave, yagi), frequency input, dimensions output |
| 12 | Signal Strength Meter | Real-time RSSI display at current frequency | Utility (needs HackRF) | Analog/digital meter, peak hold, history graph |

---

## Per-App Details

### 1. Frequency Manager
- **Purpose:** Manage frequency databases compatible with Mayhem's `freqman` text format.
- **Features:**
  - Load/save `.txt` frequency files (Mayhem format: `f=freq,d=description,m=modulation,b=bandwidth`).
  - Search by frequency, description, or modulation type.
  - Categories/folders for organization.
  - "Tune to" button → switch to appropriate RX app at that frequency.
  - Import from CSV, export to Mayhem format.
- **Storage:** Tauri app-data directory. Files are plain text.

### 2. File Manager
- **Purpose:** Browse application data: IQ captures, WAV recordings, screenshots, exported data.
- **Features:**
  - Tree view of app data directory.
  - File type recognition (`.cu8`, `.cs8`, `.cf32`, `.wav`, `.sub`, `.txt`).
  - Preview: metadata display (size, duration estimate for IQ files, sample rate if in filename).
  - Actions: delete, rename, copy, open folder in OS explorer.
- **Implementation:** Tauri `fs` plugin + `dialog` plugin for native file operations.

### 3. Playlist
- **Purpose:** Automate sequential execution of app actions.
- **Use case:** "Scan these 5 frequencies for 30s each, then transmit a beacon, repeat."
- **Features:**
  - Step list: each step = app ID + params + duration or condition.
  - Conditions: timeout, signal detected, manual advance.
  - Loop/repeat.
  - Save/load playlist files (JSON).
- **Implementation:** Frontend state machine that calls `startApp` / `stopApp` commands on schedule.

### 4. Settings
- **Sections:**
  - **Audio:** Output device selection, volume, buffer size.
  - **Radio defaults:** Default gains (LNA, VGA, TX VGA), default sample rate.
  - **Appearance:** Dark/light theme, waterfall colormap, font size.
  - **Paths:** IQ capture directory, frequency database directory.
  - **About:** Version, build info, license, links.
- **Storage:** Tauri `store` plugin or TOML file in app-data.
- **Implementation:** Settings page with immediate-apply semantics. Values persisted to disk.

### 5. Calculator
- **Tabs:**
  - **Standard:** Basic arithmetic calculator.
  - **RF:** Wavelength ↔ frequency, dBm ↔ mW ↔ W, VSWR ↔ return loss, free-space path loss, Fresnel zone, link budget.
  - **Unit converter:** MHz/kHz/GHz, meters/feet/inches, time/samples.
- **Implementation:** Pure frontend computation. No backend calls.

### 6. Notepad
- **Features:** Textarea, auto-save to file, timestamp button (inserts current datetime), word count.
- **Implementation:** Minimal — `<textarea>` with Tauri file write on change (debounced).

### 7. Snake
- **Implementation:** HTML5 Canvas game. Standard snake rules. High score persistence (localStorage or Tauri store).
- **Why include it:** Mayhem firmware has it. Feature completeness / fun easter egg.

### 8. Doom
- **Implementation:** Not a full Doom port. Options:
  - (a) Embed a WASM Doom port (e.g., wasm-doom) in the WebView.
  - (b) Simple "Doom-like" raycaster tribute game (custom, simpler).
  - Prefer option (b) for licensing simplicity and smaller binary.
- **Controls:** WASD + mouse or arrow keys.

### 9. Morse Trainer
- **Modes:**
  - **Receive practice:** Generate random characters/words as audio (sidetone), user types what they hear.
  - **Send practice:** Display text, user "keys" via keyboard, app checks timing.
- **Features:** Configurable WPM, Farnsworth timing, Koch method (progressive character introduction).
- **Audio:** Web Audio API oscillator for sidetone. No HackRF needed.

### 10. Band Plan Viewer
- **Data:** ITU band allocations by region. Amateur band plans by country.
- **UI:** Horizontal frequency axis (logarithmic), colored segments per service, zoom/pan, click for details.
- **Data source:** Static JSON compiled from ITU/ARRL/RSGB published band plans.

### 11. Antenna Calculator
- **Formulas:**
  - Dipole: L(m) = 143 / f(MHz)
  - Quarter-wave vertical: L(m) = 71.5 / f(MHz)
  - Yagi elements: director/reflector spacing and lengths from standard designs.
- **UI:** Select antenna type, enter frequency, display dimensions with diagram.

### 12. Signal Strength Meter
- **Note:** This is the one app in this phase that uses the HackRF.
- **DSP:** HackRF source → FFT → extract power at center frequency → display as dB value.
- **UI:** Analog-style needle meter (SVG), digital readout, peak hold, rolling history graph.
- **Use case:** Antenna alignment, signal hunting, RF environment survey.

---

## Suggested Per-App First Slice

| App | First slice | Stretch |
|-----|-------------|---------|
| Frequency Manager | Load + display freqman file, search | Edit, create, tune-to integration |
| File Manager | List app data dir, show file metadata | Preview, delete, rename |
| Playlist | Manual step list, sequential execute | Conditions, loop, save/load |
| Settings | Theme + default gains + paths | Audio device enum, full persistence |
| Calculator | Standard + wavelength/dBm conversions | Full RF tab, link budget |
| Notepad | Textarea + save | Timestamp, find/replace |
| Snake | Playable snake with score | Levels, high score persist |
| Doom | Simple raycaster with movement | Enemies, items, levels |
| Morse Trainer | RX mode: random chars at fixed WPM | Koch, TX practice, progress tracking |
| Band Plan Viewer | Static chart, zoom | Region selector, search |
| Antenna Calculator | Dipole + quarter-wave | Yagi, diagram, materials |
| Signal Strength Meter | RSSI number + bar | Analog meter, history graph |

---

## Implementation Notes

- **No radio backend needed** for apps 1–11. They are pure frontend (React + Tauri filesystem APIs). This makes them fast to implement and easy to test.
- **Signal Strength Meter (app 12)** is the exception — it reuses the HackRF source and spectrum DSP from Phase 0. It's essentially a simplified NFM app that only displays power, no audio.
- **Frequency Manager interop:** Aim to read Mayhem's freqman text format directly so users can copy their existing frequency databases from PortaPack SD cards.
- **Playlist is a "meta-app"** — it orchestrates other apps. Implementation requires that the app-switching infrastructure (AppRunner) supports programmatic control, which it already does via Tauri commands.
- **Games are low priority** but high fun factor. Implement last in the phase. Keep scope minimal — these are easter eggs, not production games.
- **Settings persistence:** Use Tauri's `tauri-plugin-store` for key-value persistence, or a simple TOML file read/written via Rust. Avoid complex database for settings.
