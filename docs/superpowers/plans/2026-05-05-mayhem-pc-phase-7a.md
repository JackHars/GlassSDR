# Mayhem PC Phase 7a — Utilities: Frequency Manager, File Manager, Playlist, Settings, Calculator, Notepad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 UI-only utility apps that require no HackRF: Frequency Manager, File Manager, Playlist, Settings, Calculator, and Notepad. Pure frontend + Tauri filesystem APIs.

**Architecture:** No DSP or radio backend. These apps use React components, Zustand state, Tauri `fs`/`dialog`/`store` plugins for file operations and persistence. Settings introduces a persistent configuration store.

**Spec reference:** `docs/superpowers/phase-specs/phase-7-utilities-games.md`

---

## File structure produced by this plan

```
frontend/src/apps/
├── freq-manager/
│   ├── FreqManagerApp.tsx
│   └── freqman-parser.ts          # Mayhem freqman format parser/writer
├── file-manager/
│   └── FileManagerApp.tsx
├── playlist/
│   └── PlaylistApp.tsx
├── settings/
│   └── SettingsApp.tsx
├── calculator/
│   └── CalculatorApp.tsx
└── notepad/
    └── NotepadApp.tsx

frontend/src/store/
├── settings-slice.ts              # Persistent settings state
└── index.ts                       # Updated with settings slice

src-tauri/
├── src/commands.rs                # add file-browse, settings read/write commands
└── tauri.conf.json                # add fs/dialog plugin permissions
```

---

## Task 1: Tauri filesystem + settings commands

**Why first:** Multiple apps need file browsing and persistent settings. Establish the backend support first.

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add file system commands**

```rust
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub modified_ms: f64,
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }
    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in read_dir.flatten() {
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified = meta.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as f64)
            .unwrap_or(0.0);
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size_bytes: meta.len(),
            modified_ms: modified,
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
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(&p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_app_data_dir(handle: tauri::AppHandle) -> Result<String, String> {
    handle.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Add settings persistence commands**

```rust
use std::collections::HashMap;

#[tauri::command]
pub async fn load_settings(handle: tauri::AppHandle) -> Result<HashMap<String, serde_json::Value>, String> {
    let path = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let settings_file = path.join("settings.json");
    if !settings_file.exists() {
        return Ok(HashMap::new());
    }
    let content = std::fs::read_to_string(&settings_file).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(handle: tauri::AppHandle, settings: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let path = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    let settings_file = path.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&settings_file, &content).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Register commands in main.rs and commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs src-tauri/tauri.conf.json
git commit -m "tauri: filesystem + settings persistence commands for utility apps"
```

---

## Task 2: Frequency Manager app

**Files:**
- Create: `frontend/src/apps/freq-manager/FreqManagerApp.tsx`
- Create: `frontend/src/apps/freq-manager/freqman-parser.ts`

- [ ] **Step 1: Implement freqman format parser**

```typescript
// freqman-parser.ts
// Parses Mayhem's freqman text format:
// f=433920000,d=Doorbell,m=AM,b=10000

export interface FreqEntry {
  frequency: number;
  description: string;
  modulation: string;
  bandwidth: number;
  step?: number;
}

export function parseFreqman(text: string): FreqEntry[] {
  return text.split('\n')
    .filter(line => line.trim().startsWith('f='))
    .map(line => {
      const fields: Record<string, string> = {};
      line.split(',').forEach(part => {
        const [key, val] = part.split('=');
        if (key && val) fields[key.trim()] = val.trim();
      });
      return {
        frequency: parseInt(fields.f || '0', 10),
        description: fields.d || '',
        modulation: fields.m || 'FM',
        bandwidth: parseInt(fields.b || '0', 10),
        step: fields.s ? parseInt(fields.s, 10) : undefined,
      };
    });
}

export function serializeFreqman(entries: FreqEntry[]): string {
  return entries.map(e => {
    let line = `f=${e.frequency},d=${e.description},m=${e.modulation}`;
    if (e.bandwidth) line += `,b=${e.bandwidth}`;
    if (e.step) line += `,s=${e.step}`;
    return line;
  }).join('\n');
}
```

- [ ] **Step 2: Implement FreqManagerApp component**

Features: load/save .txt files, search/filter, add/edit/delete entries, "tune to" button.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/apps/freq-manager/
git commit -m "frontend: Frequency Manager app (freqman format, search, CRUD)"
```

---

## Task 3: File Manager app

**Files:**
- Create: `frontend/src/apps/file-manager/FileManagerApp.tsx`

- [ ] **Step 1: Implement FileManagerApp**

Features: tree view of app-data directory, file metadata display (size, type, date), delete/rename actions, open-in-OS button.

```tsx
// Key structure:
// - useEffect to load directory listing via list_directory command
// - File type icons based on extension (.cu8, .cs8, .wav, .sub, .txt)
// - Click file → show metadata in side panel
// - Action buttons: Delete, Rename, Open Folder
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/file-manager/
git commit -m "frontend: File Manager app (directory browse, metadata, delete/rename)"
```

---

## Task 4: Playlist app

**Files:**
- Create: `frontend/src/apps/playlist/PlaylistApp.tsx`

- [ ] **Step 1: Implement PlaylistApp**

Features: step list editor, each step = app + params + duration. Play/pause/skip controls. Loop toggle. Save/load playlist JSON.

```typescript
interface PlaylistStep {
  appId: string;
  params: Record<string, unknown>;
  duration_s: number;
  condition: 'timeout' | 'manual';
}

interface Playlist {
  name: string;
  steps: PlaylistStep[];
  loop: boolean;
}
```

The component manages a state machine: idle → playing (step N) → next step or loop.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/playlist/
git commit -m "frontend: Playlist app (sequential app execution, save/load JSON)"
```

---

## Task 5: Settings app

**Files:**
- Create: `frontend/src/apps/settings/SettingsApp.tsx`
- Create: `frontend/src/store/settings-slice.ts`
- Modify: `frontend/src/store/index.ts`

- [ ] **Step 1: Implement settings store slice**

```typescript
// settings-slice.ts
interface SettingsSlice {
  theme: 'dark' | 'light';
  defaultLnaGain: number;
  defaultVgaGain: number;
  defaultTxVgaGain: number;
  waterfallColormap: string;
  captureDirectory: string;
  freqmanDirectory: string;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: unknown) => Promise<void>;
}
```

- [ ] **Step 2: Implement SettingsApp component**

Sections: Appearance (theme, colormap), Radio Defaults (gains), Paths (capture dir, freqman dir), About (version/build info).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/apps/settings/ frontend/src/store/settings-slice.ts frontend/src/store/index.ts
git commit -m "frontend: Settings app with persistent configuration (theme, gains, paths)"
```

---

## Task 6: Calculator app

**Files:**
- Create: `frontend/src/apps/calculator/CalculatorApp.tsx`

- [ ] **Step 1: Implement CalculatorApp**

Two tabs:
- **Standard:** Basic arithmetic (buttons 0-9, +, -, ×, ÷, =, C).
- **RF:** Wavelength ↔ frequency, dBm ↔ mW ↔ W, VSWR ↔ return loss, free-space path loss.

```typescript
// RF calculations:
const wavelength_m = (freq_hz: number) => 299792458 / freq_hz;
const dbm_to_mw = (dbm: number) => Math.pow(10, dbm / 10);
const mw_to_dbm = (mw: number) => 10 * Math.log10(mw);
const vswr_to_return_loss = (vswr: number) => -20 * Math.log10((vswr - 1) / (vswr + 1));
const fspl_db = (freq_hz: number, dist_m: number) => 20 * Math.log10(dist_m) + 20 * Math.log10(freq_hz) - 147.55;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/calculator/
git commit -m "frontend: Calculator app (standard arithmetic + RF calculations)"
```

---

## Task 7: Notepad app

**Files:**
- Create: `frontend/src/apps/notepad/NotepadApp.tsx`

- [ ] **Step 1: Implement NotepadApp**

Simple textarea with auto-save (debounced write to app-data/notes.txt), timestamp insert button, word count footer.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/notepad/
git commit -m "frontend: Notepad app (auto-save, timestamp insert, word count)"
```

---

## Task 8: IPC types + app switcher integration

**Files:**
- Modify: `crates/mayhem-ipc/src/lib.rs`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add AppId variants (UI-only apps don't need backend flowgraphs)**

```rust
// These apps run entirely in the frontend. The AppId exists for switcher routing.
FreqManager, FileManager, Playlist, Settings, Calculator, Notepad,
```

- [ ] **Step 2: Add to frontend switcher**

These apps don't call `startApp` — they render directly in the frontend without backend interaction (except file I/O via Tauri commands).

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
cargo check -p mayhem-pc
```

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-ipc/src/lib.rs frontend/src/App.tsx
git commit -m "Phase 7a integration: AppId variants + switcher for 6 utility apps"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | Tauri FS + settings commands | File list, read/write, settings persist |
| 2 | Frequency Manager | Parse/write freqman, search, CRUD |
| 3 | File Manager | Browse app-data, metadata, delete |
| 4 | Playlist | Step editor, play/pause, save/load |
| 5 | Settings | Theme + gains + paths persist |
| 6 | Calculator | Arithmetic + RF conversions |
| 7 | Notepad | Auto-save textarea |
| 8 | Switcher integration | All 6 visible, builds pass |
