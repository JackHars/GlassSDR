# GlassSDR Dedicated-UI — Ralph Loop instructions

Give every one of GlassSDR's 83 apps its own purpose-built, bespoke-identity
screen, inside the existing Liquid Glass design language. One screen per
iteration. Loop until the completion promise.

## Ultrathink
Before writing any code each iteration, **ultrathink**: what signal does this
radio mode carry, what would an operator of *this specific* mode want to see at a
glance, what is the single signature "hero" visual, and what are its states
(idle / acquiring / live / empty / error)? A great screen is designed, not
templated.

## Authoritative plan
Three docs in the repo are the spec. Re-read them as needed:
1. `docs/ui/00-foundations.md` — design language, the bespoke-identity model, the
   theming mechanism, the shared component kit, the archetypes, the per-iteration
   process, the **gate** (definition of done), and the repo constraints.
2. `docs/ui/01-app-screens.md` — the per-app design brief for all 83 apps
   (route file, base archetype, which IPC data to reuse, palette, hero, motif).
3. `docs/ui/PROGRESS.md` — the ledger. It defines the order and tracks what's done.

## Use the frontend-design skill, but match GlassSDR's theme
Each iteration, use the **frontend-design skill** for craft and process — **but
do not let it impose a generic look**. Conform to GlassSDR's Liquid Glass system
(`frontend/src/styles/glass.css`: translucent glass surfaces, blur, Apple-layered
shadows, the radius/spring tokens, Inter for UI, mono for RF numbers) and to the
app's bespoke identity from the plan (its accent palette, hero, and motif). The
skill informs *how well* you build; the plan and the theme decide *how it looks*.

## Hard scope
- **Frontend only.** Edit `frontend/` only. The Rust backend, DSP, protocol
  codecs, and Tauri IPC contract are frozen. Build every screen from IPC events
  and commands that already exist.
- **Reuse real data.** For app `<id>`, before designing, read: its current view
  `frontend/src/apps/<dir>/<Name>App.tsx`, its Rust source
  `crates/mayhem-apps/src/<id>.rs` (the truth for the emitted event name +
  payload fields), and its type under `frontend/src/ipc/types/`. Never invent an
  event, field, or command. If data you want isn't emitted, design around what is.
- **Don't break the shell** (`App.tsx` registry/lazy-loading, the titlebar, the
  home grid). `usb_rx` and `lsb_rx` stay one component (`SsbRxApp`) — mode-aware,
  not two files.
- **Preserve plumbing** where used: `AudioSink`+`resumeAudio()`, `RecordBar`, and
  the arm/disarm + `LegalBanner` TX gate. Restyle, don't remove.

## Plan structure — two phases, in order
Do not start Phase B until every Phase A box in `PROGRESS.md` is ticked.

### PHASE A — shared foundation (kit + theming)
Build, in `PROGRESS.md` order, the theme registry, the `AppScreen` scaffold, the
`glass.css` accent/ambient wiring, and the component kit (foundations §4–5).
Reuse the existing `Waterfall`, `AircraftMap`, `AudioSink`, `RecordBar`,
`FrequencyInput`, `TuningControls`, `LegalBanner` — generalize, don't replace.
One ledger box per iteration.

### PHASE B — app screens
For each app in `PROGRESS.md` order (suggested build order at bottom of
`01-app-screens.md`: tools → receivers → clusters → … → testing last), build
exactly one bespoke screen per iteration, composing the kit. Where the plan marks
a 🧩 cluster (digital-voice dmr/dpmr/p25/nxdn/tetra; paging; imaging; BLE; 2.4 GHz
TX), build one shared inner component and theme it per app — reuse, don't
duplicate.

## Each iteration (exactly one forward step)
1. **Orient.** `git log --oneline -15`; read `docs/ui/PROGRESS.md`; pick the first
   unticked box.
2. **Ultrathink** the screen (above).
3. **Research** the app's real data (read `.tsx` + `.rs` + type).
4. Use the **frontend-design skill**, conforming to the theme + the app's identity.
5. **Build** the screen + per-app `<Name>.css` + theme-registry entry, composing
   the kit.
6. **Gate** (foundations §7): `cd frontend && npm run typecheck` passes; `npm run
   build` succeeds; screen mounts with no console errors; correct empty state;
   only real IPC, unlistened on unmount; theme wrapper + signature hero present;
   glass cohesion + window-resize reflow; plumbing preserved; self-review vs the
   spec. If it fails, fix it this iteration — never advance broken or generic.
7. **Commit** one app: `feat(ui): bespoke <App> screen` (or `feat(ui): <kit
   item>` in Phase A). Tick the box in `PROGRESS.md` in the same commit.

## Constraints
- Work on the `ui-redesign` branch (create it from the current branch on the
  first iteration). Never push to any remote. Never `git reset --hard`. Never
  force-push.
- Commit per app / per kit task — never batch multiple screens into one commit.
- **NEVER** put the words *Claude*, *Co-Authored-By*, the robot emoji, or the
  phrase *Generated with* in any commit message — a hook blocks them. Write
  commits as a human author would. If blocked, rewrite with no attribution and
  retry.

## Completion
When every box in `docs/ui/PROGRESS.md` (Phase A + all 83 app screens) is ticked,
each passed the gate, and all commits are on `ui-redesign`, output the promise
tag containing the literal string **`ALL SCREENS COMPLETE`**.

If you hit a genuine blocker you cannot resolve, write the cause to
`.claude/BLOCKED.md` and output the promise tag containing the literal string
**`BLOCKED`**.
