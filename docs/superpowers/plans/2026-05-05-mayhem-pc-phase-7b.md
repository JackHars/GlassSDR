# Mayhem PC Phase 7b — Games & Remaining Utilities: Snake, Doom, Morse Trainer, Band Plan, Antenna Calc, Signal Meter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 remaining Phase 7 apps: Snake, Doom (raycaster tribute), Morse Trainer, Band Plan Viewer, Antenna Calculator, and Signal Strength Meter. First 5 are frontend-only; Signal Meter uses HackRF.

**Architecture:** Games use HTML5 Canvas. Morse Trainer uses Web Audio oscillator. Band Plan uses static JSON data + zoomable SVG chart. Signal Meter reuses HackRF source + FFT from Phase 0.

**Spec reference:** `docs/superpowers/phase-specs/phase-7-utilities-games.md`

---

## File structure produced by this plan

```
frontend/src/apps/
├── snake/SnakeApp.tsx
├── doom/DoomApp.tsx               # Simple raycaster
├── morse-trainer/MorseTrainerApp.tsx
├── band-plan/
│   ├── BandPlanApp.tsx
│   └── band-data.ts              # ITU/amateur band allocations as JSON
├── antenna-calc/AntennaCalcApp.tsx
└── signal-meter/SignalMeterApp.tsx

crates/mayhem-apps/src/
└── signal_meter.rs                # Reuses HackRF + FFT, emits power level

crates/mayhem-ipc/src/lib.rs       # SignalMeter AppId + event type
```

---

## Task 1: Snake game

**Files:**
- Create: `frontend/src/apps/snake/SnakeApp.tsx`

- [ ] **Step 1: Implement Snake**

```tsx
// Classic snake on HTML5 Canvas.
// - Arrow keys / WASD to control direction
// - Grid-based movement, food spawns randomly
// - Score display, speed increases with length
// - Game over on wall/self collision
// - High score persisted to localStorage

import { useEffect, useRef, useState } from 'react';

export function SnakeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(
    parseInt(localStorage.getItem('snake_high') || '0', 10)
  );
  const [gameOver, setGameOver] = useState(false);

  // Grid: 20x20 cells, each 20px = 400x400 canvas
  const GRID = 20;
  const CELL = 20;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let snake = [{ x: 10, y: 10 }];
    let food = spawnFood(snake);
    let dir = { x: 1, y: 0 };
    let nextDir = dir;
    let running = true;
    let currentScore = 0;

    function spawnFood(snake: { x: number; y: number }[]) {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      } while (snake.some(s => s.x === pos.x && s.y === pos.y));
      return pos;
    }

    function tick() {
      if (!running) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Collision check
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID ||
          snake.some(s => s.x === head.x && s.y === head.y)) {
        running = false;
        setGameOver(true);
        if (currentScore > highScore) {
          localStorage.setItem('snake_high', String(currentScore));
          setHighScore(currentScore);
        }
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        currentScore++;
        setScore(currentScore);
        food = spawnFood(snake);
      } else {
        snake.pop();
      }

      // Draw
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, GRID * CELL, GRID * CELL);
      ctx.fillStyle = '#0f0';
      snake.forEach(s => ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2));
      ctx.fillStyle = '#f00';
      ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);
    }

    const interval = setInterval(tick, 120);

    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp': case 'w': if (dir.y === 0) nextDir = { x: 0, y: -1 }; break;
        case 'ArrowDown': case 's': if (dir.y === 0) nextDir = { x: 0, y: 1 }; break;
        case 'ArrowLeft': case 'a': if (dir.x === 0) nextDir = { x: -1, y: 0 }; break;
        case 'ArrowRight': case 'd': if (dir.x === 0) nextDir = { x: 1, y: 0 }; break;
      }
    }
    window.addEventListener('keydown', handleKey);

    return () => { clearInterval(interval); window.removeEventListener('keydown', handleKey); };
  }, [gameOver]);

  return (
    <div className="snake-app">
      <h2>Snake</h2>
      <div>Score: {score} | High: {highScore}</div>
      <canvas ref={canvasRef} width={GRID * CELL} height={GRID * CELL} />
      {gameOver && <button onClick={() => setGameOver(false)}>Play Again</button>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/snake/
git commit -m "frontend: Snake game (canvas, high score persistence)"
```

---

## Task 2: Doom (raycaster tribute)

**Files:**
- Create: `frontend/src/apps/doom/DoomApp.tsx`

- [ ] **Step 1: Implement simple raycaster**

A minimal Wolfenstein 3D-style raycaster:
- 2D map (grid of walls)
- First-person view via raycasting on canvas
- WASD movement + mouse/arrow look
- Simple textured walls (solid colors per wall face)
- No enemies in first version (stretch goal)

```tsx
// Core raycasting loop:
// For each column of the screen:
//   1. Cast ray from player position at angle
//   2. Step through grid until wall hit (DDA algorithm)
//   3. Compute wall distance → wall height on screen
//   4. Draw vertical stripe (color based on wall type + distance shading)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/doom/
git commit -m "frontend: Doom-style raycaster game (DDA, WASD movement)"
```

---

## Task 3: Morse Trainer

**Files:**
- Create: `frontend/src/apps/morse-trainer/MorseTrainerApp.tsx`

- [ ] **Step 1: Implement Morse Trainer**

Two modes:
- **Receive:** Generate random characters as audio (Web Audio oscillator), user types what they hear. Score accuracy.
- **Settings:** WPM slider (5-40), tone frequency (400-1000 Hz), Koch method toggle (progressive chars).

```tsx
// Uses Web Audio API:
// const osc = audioCtx.createOscillator();
// osc.frequency.value = toneHz;
// Play dit/dah durations based on WPM.

// Koch method: start with 2 chars (K, M), add one when >90% accuracy.
const KOCH_ORDER = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/morse-trainer/
git commit -m "frontend: Morse Trainer app (RX practice, WPM control, Koch method)"
```

---

## Task 4: Band Plan Viewer

**Files:**
- Create: `frontend/src/apps/band-plan/BandPlanApp.tsx`
- Create: `frontend/src/apps/band-plan/band-data.ts`

- [ ] **Step 1: Implement band allocation data**

```typescript
// band-data.ts — static band allocations
export interface BandAllocation {
  start_hz: number;
  end_hz: number;
  service: string;
  color: string;
  region: 1 | 2 | 3; // ITU regions
}

export const AMATEUR_BANDS: BandAllocation[] = [
  { start_hz: 1_800_000, end_hz: 2_000_000, service: '160m', color: '#e74c3c', region: 2 },
  { start_hz: 3_500_000, end_hz: 4_000_000, service: '80m', color: '#e67e22', region: 2 },
  { start_hz: 7_000_000, end_hz: 7_300_000, service: '40m', color: '#f1c40f', region: 2 },
  { start_hz: 14_000_000, end_hz: 14_350_000, service: '20m', color: '#2ecc71', region: 2 },
  { start_hz: 21_000_000, end_hz: 21_450_000, service: '15m', color: '#3498db', region: 2 },
  { start_hz: 28_000_000, end_hz: 29_700_000, service: '10m', color: '#9b59b6', region: 2 },
  { start_hz: 50_000_000, end_hz: 54_000_000, service: '6m', color: '#1abc9c', region: 2 },
  { start_hz: 144_000_000, end_hz: 148_000_000, service: '2m', color: '#e74c3c', region: 2 },
  { start_hz: 420_000_000, end_hz: 450_000_000, service: '70cm', color: '#e67e22', region: 2 },
  { start_hz: 902_000_000, end_hz: 928_000_000, service: '33cm', color: '#f1c40f', region: 2 },
  { start_hz: 1_240_000_000, end_hz: 1_300_000_000, service: '23cm', color: '#2ecc71', region: 2 },
  // ... more bands
];
```

- [ ] **Step 2: Implement BandPlanApp with zoomable chart**

SVG-based horizontal frequency axis (logarithmic scale), colored bands, zoom/pan, click for details.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/apps/band-plan/
git commit -m "frontend: Band Plan Viewer (zoomable SVG chart, ITU region 2 amateur bands)"
```

---

## Task 5: Antenna Calculator

**Files:**
- Create: `frontend/src/apps/antenna-calc/AntennaCalcApp.tsx`

- [ ] **Step 1: Implement AntennaCalcApp**

```tsx
// Antenna dimension formulas:
// Dipole: total length (m) = 143 / freq_mhz (each element = half)
// Quarter-wave vertical: length (m) = 71.5 / freq_mhz
// 5/8 wave vertical: length (m) = 178.5 / freq_mhz
// Yagi driven element: same as dipole; directors 5% shorter, reflector 5% longer

// UI: frequency input → instant calculation of dimensions for each type
// Show simple SVG diagram of antenna with dimension labels
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/antenna-calc/
git commit -m "frontend: Antenna Calculator (dipole, quarter-wave, 5/8, yagi dimensions)"
```

---

## Task 6: Signal Strength Meter (uses HackRF)

**Files:**
- Create: `crates/mayhem-apps/src/signal_meter.rs`
- Modify: `crates/mayhem-apps/src/lib.rs`
- Modify: `crates/mayhem-ipc/src/lib.rs`
- Create: `frontend/src/apps/signal-meter/SignalMeterApp.tsx`

- [ ] **Step 1: Implement signal_meter.rs**

```rust
//! Signal Strength Meter: HackRF → FFT → peak power at center frequency → emit dB value.
//! Simplified version of NFM app that only outputs power, no audio.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct SignalMeterApp {
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl SignalMeterApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { spectrum_tx }, spectrum_rx)
    }
}

impl App for SignalMeterApp {
    fn metadata() -> AppMetadata {
        AppMetadata {
            id: AppId::SignalMeter,
            name: "Signal Meter".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();
        let join = tokio::task::spawn_blocking(move || {
            let _ = (params, spectrum_tx, stop_rx);
            // Flowgraph: HackRF → FFT → emit SpectrumFrame (frontend extracts peak power)
        });
        Ok(RunningApp { stop: stop_tx, join })
    }
}
```

- [ ] **Step 2: Add IPC types**

```rust
// Add to AppId enum:
SignalMeter,

// Reuse SpectrumFrame for power data — frontend computes peak.
// Add a dedicated event for simpler consumption:
pub struct SignalLevel {
    pub power_db: f32,
    pub peak_freq_hz: f64,
}
```

- [ ] **Step 3: Implement SignalMeterApp frontend**

Analog-style SVG needle meter, digital dBm readout, peak hold indicator, rolling history graph (last 60 seconds).

- [ ] **Step 4: Commit**

```bash
git add crates/mayhem-apps/src/signal_meter.rs crates/mayhem-apps/src/lib.rs crates/mayhem-ipc/src/lib.rs frontend/src/apps/signal-meter/
git commit -m "Signal Strength Meter: backend (HackRF + FFT) + frontend (analog meter + history)"
```

---

## Task 7: App switcher + build verification

**Files:**
- Modify: `src-tauri/src/runner.rs`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Register SignalMeter in runner**

- [ ] **Step 2: Add all 6 Phase 7b apps to switcher**

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
cargo check -p mayhem-pc
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/runner.rs frontend/src/App.tsx
git commit -m "Phase 7b integration: register Signal Meter, add 6 apps to switcher"
```

---

## Summary

| Task | What | Acceptance |
|------|------|-----------|
| 1 | Snake | Canvas game, arrow keys, high score |
| 2 | Doom | Raycaster renders, WASD movement |
| 3 | Morse Trainer | Audio plays, accuracy tracked |
| 4 | Band Plan | Zoomable chart, band data |
| 5 | Antenna Calc | Formulas compute, diagram shows |
| 6 | Signal Meter | Backend FFT + frontend meter |
| 7 | Switcher | All visible, builds pass |
