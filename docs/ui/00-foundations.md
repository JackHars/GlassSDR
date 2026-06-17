# GlassSDR — Dedicated-UI Redesign · Foundations

> The plan that the UI ralph-loop consumes. Read this **before every iteration**,
> then read the per-app entry in [`01-app-screens.md`](./01-app-screens.md) for
> the app you are building, then build exactly one screen.

## 0. The problem we are solving

GlassSDR ships **83 apps** (`frontend/src/apps/*`). Today almost every screen is a
thin wrapper around a shared `AppShell`/`TxAppShell` + a generic `DecoderTable`,
`Waterfall`, or `AircraftMap`. They *work*, but they have **no dedicated UI** —
a POCSAG pager feed looks identical to a DMR call log, an EPIRB distress beacon
looks like a tire-pressure sensor, an SSTV transmitter looks like a text form.

This redesign gives **every app its own purpose-built screen with a bespoke
visual identity**, while staying inside one coherent Liquid Glass design language.

## 1. Hard constraints (do not violate)

- **Frontend-only.** You may only edit `frontend/`. The Rust backend, the DSP,
  the protocol codecs, and the Tauri IPC contract are **frozen**. Every screen
  must be built from the IPC events and commands that **already exist**.
- **Reuse the real data.** Discover an app's data before designing it. For app
  `<id>` you must read:
  1. its current view `frontend/src/apps/<dir>/<Name>App.tsx`,
  2. its Rust source `crates/mayhem-apps/src/<id>.rs` (for the emitted event
     name + payload field names — the source of truth), and
  3. the matching type in `frontend/src/ipc/types/` if one exists.
  Never invent an event name, a field, or a command. If the data you wish you
  had isn't emitted, design around what *is* emitted.
- **Don't break the shell.** The home grid, the traffic-light titlebar, the
  `← Home` button, lazy-loading in `App.tsx`, and the `APP_MAP`/`SPECIAL_APPS`
  registry stay intact. `usb_rx` and `lsb_rx` continue to share one component
  (`SsbRxApp`) via props — give that component a mode-aware identity, not two
  files.
- **Preserve plumbing widgets.** Where an app records, keep `RecordBar`. Where it
  plays audio, keep `AudioSink` + `resumeAudio()`. Where it transmits, keep the
  arm/disarm + `LegalBanner` legal gate. You may restyle these, not remove them.
- **One app per iteration**, then the gate (§7), then a commit. Never batch.

## 2. The design language (keep this)

The system is defined in `frontend/src/styles/glass.css` — **light-mode Liquid
Glass**. Do not fork it; extend it. The non-negotiable cohesion rules that make
83 different screens feel like one app:

- **Surfaces** are translucent white glass: `var(--glass-bg)` over the animated
  mesh background, `backdrop-filter: blur(var(--glass-blur))`, `1px` light
  border, layered Apple-style shadows (`--shadow-sm/md/lg`), radii
  `--glass-radius` / `-sm` / `-lg`.
- **Type**: `--font-sans` (Inter / SF Pro) for UI, `--font-mono` (SF Mono /
  JetBrains Mono) for any number that represents a measured RF quantity
  (frequency, dBm, baud, capcode, MMSI, hex). RF data is *always* mono.
- **Motion**: the spring/ease tokens (`--spring-snappy`, `--ease-out-expo`,
  …). Entrances fade+rise; controls press in. No new easing curves.
- **Depth**: content floats on glass above the mesh gradient; never paint a flat
  opaque panel.

## 3. Bespoke identity — what "give every app its own UI" means

Each app gets a distinct identity built from **five** levers. Bespoke ≠ off-brand:
you change accent, hero, motif, density and motion — you never change the glass
material, the blur, the radii, the font families, or the shell chrome.

1. **Accent + ambient palette.** Each app overrides the accent tokens via a
   theme wrapper (see §4). Use the per-app palette in the spec. The category
   families are the starting point:
   | Family | Hue direction | Used by |
   |---|---|---|
   | Aviation | sky→emerald greens/teals | ADS-B, ACARS, spoofer |
   | Maritime | deep navy→cyan | AIS, DSC, EPIRB(sea) |
   | Broadcast | warm indigo→magenta | WFM, RDS, DAB |
   | Voice/HF | amber→gold | AM, SSB, CW, NFM |
   | Paging/data | pink→rose | POCSAG, FLEX, pagers |
   | Digital voice | violet→blue | DMR, dPMR, P25, NXDN, TETRA |
   | Sensors | slate + signal-green | ERT, TPMS, weather |
   | Emergency | red→orange (alarm) | EPIRB, two-tone, distress DSC |
   | Satellite/imaging | cosmic indigo→cyan | APT, HRPT, LRPT |
   | Transmit | the warning hue is law: amber armed / red live | all TX |
   | Test/dual-use | hazard amber + diagonal hazard motif | spoofers, emulators |
   | Analysis | neutral graphite + accent-on-data | scanners, analyzers |
   | Tools | calm blue, paper-like | calc, notepad, band plan |
2. **A signature "hero".** Every screen has one dominant, app-specific
   visualization that you'd recognize from across the room: a pager slip, a
   marine chart, a progressive satellite image, an analog S-meter needle, a
   constellation/eye diagram, a Morse paddle, a hazard-striped arming console.
3. **A motif.** A small repeated visual idea — scanlines for imaging, a sonar
   sweep for maritime, a runway/altitude ladder for aviation, perforated-paper
   edges for paging, a hazard chevron for dual-use TX.
4. **Density & rhythm.** A monitoring feed (POCSAG, AIS) is dense and
   log-like; a calculator or trainer is spacious and centered; a TX console is
   deliberate and gated.
5. **Micro-interactions.** New rows slide+flash in their accent; a beacon
   pulses; an armed TX button breathes; a satellite line paints top-down.

## 4. The theming mechanism (build this in Phase A)

Bespoke color must route through tokens so cohesion holds. Implement a tiny
theme layer:

- A typed registry `frontend/src/theme/appThemes.ts` mapping each `AppId` →
  `{ accent, accentHover, accentGlow, ambient: [c1,c2], motif }`.
- `AppScreen` (the new scaffold) sets these as inline CSS custom properties on
  its root (`--accent`, `--accent-hover`, `--accent-glow`, `--accent-dim`) and a
  `data-app="<id>"` attribute, so every existing `var(--accent)` reference in
  `glass.css` retints automatically and per-app CSS can target
  `[data-app="adsb_rx"]`.
- The ambient pair feeds two extra radial-gradient stops layered over the
  existing `.glass-bg` mesh (a soft, ~8% wash — never a solid color).
- Per-app CSS lives in `frontend/src/apps/<dir>/<Name>.css`, imported by the
  view, scoped under `[data-app="<id>"]`. No global leakage.

This means a screen can look unmistakably "maritime" or "emergency" while every
button, focus ring, slider thumb and glow stays on-system.

## 5. Shared component kit (build in Phase A, before any screen)

Bespoke screens **compose** these primitives; they don't re-implement tables and
panels 83 times. Build them in `frontend/src/components/kit/` with TS props and
the glass styling. Reuse the existing `Waterfall`, `AircraftMap`, `AudioSink`,
`RecordBar`, `FrequencyInput`, `TuningControls`, `LegalBanner` rather than
replacing them.

- **`AppScreen`** — replaces ad-hoc `AppShell` usage: applies the app theme
  (§4), renders title/subtitle, a live **status pill**, a header actions slot, a
  body, and an optional footer (audio/record). The single source of layout.
- **`GlassPanel`** / **`GlassCard`** — titled translucent containers, size + pad
  variants.
- **`StatReadout`** — a big mono metric with label + unit + optional trend/peak;
  the atom for S-meters, counters, telemetry tiles.
- **`Gauge`** — SVG arc/needle meter (S-meter, SNR, link budget) with peak-hold.
- **`HeroPanel`** — full-bleed glass stage for an app's signature visual.
- **`DecoderFeed`** — the upgrade from `DecoderTable`: virtualized, newest-on-top
  message stream with accent flash-in, per-row expand to a field **Inspector**,
  filter + clear + pause, empty state. Powers every decoder app.
- **`FieldInspector`** — labeled key/value grid for decoded packet fields with
  raw-hex toggle.
- **`EntityMap`** — generalize `AircraftMap` to plot typed markers (planes,
  ships, balloons, stations) with trails, selection, and a side detail card.
- **`ProgressiveImage`** — top-down line-painting canvas for APT/HRPT/LRPT/SSTV
  with scanline motif, zoom, and save.
- **`Composer`** — message/payload editor used by TX apps (text, capcode,
  bytes/hex, image picker) with live encoded-preview.
- **`ArmConsole`** — wraps the existing arm/disarm + `LegalBanner` flow in the
  hazard-striped TX identity, with a breathing live-TX state and progress.
- **`Timeline`** — horizontal time axis for scanners, hoppers, playlists, OOK
  pulse trains.
- **`Keypad` / `FrequencyDial`** — tactile tuning input for instrument apps.
- **`EmptyState`** — themed "press Start / waiting for signal" placeholder.

Each kit component must render correctly with **zero data** (empty state) and
**streaming data**, and must resize with the window.

## 6. Screen archetypes (each app's base; identity is layered on top)

Pick the base that matches the app's data shape, then apply the app's hero +
theme. The per-app spec names the base.

- **A · Tuned-Audio RX** — `Waterfall` (hero) + `TuningControls` + `AudioSink` +
  `RecordBar`. Demodulators: NFM, WFM, AM, USB/LSB, CW.
- **B · Live-Map RX** — `EntityMap` (hero) + entity list + detail card. ADS-B(±),
  APRS, AIS, radiosonde, DSC/EPIRB-with-position.
- **C · Decoder-Feed RX** — `DecoderFeed` (hero) + `FieldInspector` + a
  protocol-specific summary band. Most Digital + Sensor apps.
- **D · Imaging RX** — `ProgressiveImage` (hero) + pass/telemetry sidebar.
  APT, HRPT, LRPT; SSTV (TX preview).
- **E · TX Composer** — `ArmConsole` + `Composer` + encoded preview + progress.
  All Transmit + Testing transmitters.
- **F · Instrument/Tool** — bespoke centered/utility layouts. Calculators,
  trainer, notepad, band plan, settings, managers.
- **G · Analysis Workbench** — `Waterfall`/`Timeline` + results table + controls
  for sweep/scan/measure. Scanner, recon, panorama, characterization, benches.

When two apps share a base **and** a near-identical data shape (e.g. DMR / dPMR /
P25 / NXDN / TETRA all stream `digital_voice`), build them on one shared inner
component parameterized by protocol metadata + theme — **reuse, don't duplicate**.
The spec marks these clusters.

## 7. The gate — definition of done for one app (must pass before commit)

An iteration is **not** done until all of these hold for the app you built:

1. `cd frontend && npm run typecheck` passes (no new TS errors).
2. `cd frontend && npm run build` (Vite) succeeds.
3. The screen mounts with **no console errors** and renders a correct **empty
   state** before data arrives.
4. It consumes only **real** IPC events/commands (verified against the Rust
   source), and unlistens on unmount (no leaked `listen` handlers).
5. It applies its **theme wrapper** (`data-app` + accent tokens) and its
   **signature hero** from the spec; it is recognizably this app, not a generic
   table.
6. Glass cohesion preserved: glass surfaces, mono for RF numbers, system motion;
   no flat opaque panels; layout reflows on window resize down to ~720px wide.
7. Plumbing preserved where applicable: `AudioSink`, `RecordBar`, arm/legal gate.
8. Self-review: re-read the spec entry and confirm hero, palette, motif, states
   (idle / live / empty / error) are all present.

If the gate fails, **fix it in the same iteration**. Do not advance with a
broken or generic screen.

## 8. Per-iteration loop (what one step looks like)

1. **Orient.** `git log --oneline -15`; read `docs/ui/PROGRESS.md`; find the
   first app whose box is unchecked. In Phase A, the "app" is a kit/theme task.
2. **Ultrathink.** Think hard before typing: what is the signal, what would an
   operator of *this* radio mode want to see, what's the one hero visual, what
   states exist (idle/acquiring/live/empty/error)?
3. **Research the data** (§1): read the `.tsx`, the `.rs`, the type.
4. **Invoke the frontend-design skill** for craft, **but conform to GlassSDR's
   theme** (§2) and the app's bespoke identity (§3–4) — the skill informs
   quality and process, it does not impose its own look.
5. **Build** the screen + its `<Name>.css` + theme registry entry, composing the
   kit.
6. **Gate** (§7).
7. **Commit** one app (`feat(ui): bespoke <App> screen`) and tick its box in
   `PROGRESS.md`.

## 9. Progress ledger

`docs/ui/PROGRESS.md` is the single source of truth for what's done. Phase A
tasks first, then all 83 apps grouped by category. Tick a box only after the
gate passes and the commit lands.

## 10. Repo constraints (same as the build loop)

- Work on a dedicated branch (`ui-redesign`); never push to any remote.
- Never `git reset --hard`; never force-push.
- Commit per app/per kit task. **Never** put the words *Claude*,
  *Co-Authored-By*, the robot emoji, or *Generated with* in a commit message —
  a hook blocks them. Write commits as a human would; if blocked, rewrite with
  no attribution and retry.
- Skip nothing for being "hard"; if genuinely blocked, write the cause to
  `.claude/BLOCKED.md` and emit the BLOCKED promise.
