# Autonomous Mayhem PC build — Ralph Loop instructions

## Reference: upstream Mayhem firmware source

The original PortaPack Mayhem firmware is cloned at:

    /tmp/mayhem-firmware

This is the authoritative reference for every app you port. Layout:

- `/tmp/mayhem-firmware/firmware/application/apps/`
  Built-in apps. ~87 files, mostly .cpp/.hpp pairs. Each app's M4-side
  protocol/UI logic.

- `/tmp/mayhem-firmware/firmware/application/external/<app_name>/`
  External apps (one directory per app). The pluggable apps that come
  via DFU on the device. Same .cpp/.hpp shape inside each subdir.

- `/tmp/mayhem-firmware/firmware/baseband/proc_*.cpp`
  ~109 baseband processors. M0-side DSP code for each app's RX/TX
  sample-rate processing. This is where the real DSP lives — FIR
  coefficients, demod loops, slicer thresholds, modulation tables.

When porting any app:
1. First locate it: `ls /tmp/mayhem-firmware/firmware/application/apps/`
   or `ls /tmp/mayhem-firmware/firmware/application/external/`. The
   spec section 6 lists which apps to skip.
2. Read its `.cpp` and `.hpp` to understand the M4-side flow: state
   machine, UI fields, message format, calls into baseband_api.
3. Find the corresponding baseband processor:
   `grep -l <app_name> /tmp/mayhem-firmware/firmware/baseband/proc_*.cpp`
4. Re-implement the DSP in Rust under `crates/mayhem-dsp/` and the
   protocol in Rust under `crates/mayhem-protocols/`. Wire it together
   in `crates/mayhem-apps/<app>.rs` following the patterns in
   `nfm_audio.rs` and `adsb_rx.rs`.
5. Front-end UI under `frontend/src/apps/<app>/` follows the patterns
   in `nfm-audio/` and `adsb-rx/`.

Useful greps to orient inside the firmware:

- All app names: `ls /tmp/mayhem-firmware/firmware/application/apps/ /tmp/mayhem-firmware/firmware/application/external/`
- Find a protocol: `grep -ril POCSAG /tmp/mayhem-firmware/firmware/`
- Find a DSP block: `grep -l fm_demod /tmp/mayhem-firmware/firmware/baseband/proc_*.cpp`

The firmware is a shallow clone. Do NOT try to fetch its history or
update it; just read the working tree.

## Plan structure

Continue executing the Mayhem PC project autonomously. Two-phase order:
PHASE A (planning, no code changes beyond writing docs) writes everything;
PHASE B (implementation) executes everything written in A. Do NOT enter
PHASE B until PHASE A is complete.

## PHASE A — write these docs in order, one per iteration

1. `docs/superpowers/plans/2026-05-05-mayhem-pc-v0.3-pocsag-tx.md`
   Plan 3, full detail like Plan 1 and Plan 2 (about 17 to 20 tasks, complete
   code in each step). Implements the third Phase 0 app: HackRF sink, FSK
   Gaussian modulator, POCSAG encoder (preamble + sync + BCH ECC),
   RegulatoryClass enforcement (legal banner, arm/disarm), RX to TX
   mode-switch handling. Acceptance criteria 7, 8, 9 from the spec.

2. `docs/superpowers/phase-specs/phase-1-voice-audio.md`
   1 to 3 pages: app list, shared DSP blocks, suggested per-app first slice.

3. `docs/superpowers/phase-specs/phase-2-fm-digital.md`
4. `docs/superpowers/phase-specs/phase-3-ook-subghz.md`
5. `docs/superpowers/phase-specs/phase-4-specialty-rx.md`
6. `docs/superpowers/phase-specs/phase-5-amateur-tx.md`
7. `docs/superpowers/phase-specs/phase-6-dualuse-tx.md`
8. `docs/superpowers/phase-specs/phase-7-utilities-games.md`
9. `docs/superpowers/phase-specs/phase-8-long-tail.md`

10 onward. Per-phase implementation plans named
    `docs/superpowers/plans/2026-05-05-mayhem-pc-phase-N.md`
    (replace N with the phase number 1 through 8). One plan per phase.
    If a phase has more than 5 apps, split into multiple plan files
    suffixed -a, -b, -c, etc. Each plan is full detail like Plan 1 and
    Plan 2.

PHASE A is COMPLETE when:
- Plan 3 exists at the path above.
- All 8 phase mini-specs exist under `docs/superpowers/phase-specs/`.
- Per-phase plans cover all non-refused apps.

Verify file existence at the start of each iteration.

## PHASE B — execute (only after PHASE A is complete)

For each plan in chronological order:
- Plan 3 first.
- Then per-phase plans for Phase 1, then Phase 2, and so on through Phase 8.

For each plan: invoke `superpowers:subagent-driven-development`.

Skip hardware acceptance items. Mark them DEFERRED in
`docs/acceptance/`.

Do NOT implement any of the 12 refused apps listed in
`docs/superpowers/specs/2026-05-05-mayhem-pc-port-design.md` section 6.

## Each iteration

Run `git log` and `ls docs/superpowers/plans/ docs/superpowers/phase-specs/`
to determine where you are. Do exactly ONE forward step per iteration:
write one document, OR execute one task within a plan via
`superpowers:subagent-driven-development`.

## Constraints

- Stay on the `autonomous-build` branch.
- Never push to remotes.
- Never run `git reset --hard`.
- NEVER include the words Claude, Co-Authored-By, the robot emoji, or the
  phrase Generated with in any commit message. Write commits as if a
  human author wrote them. A commit-attribution hook will block any
  commit message containing those strings. If blocked, rewrite the
  message with NO attribution and retry.
- Commit work as you go: one commit per task or per doc written.

## Completion

When all 8 phases plus Plan 3 are written AND fully executed, output the
promise tag containing the literal string ALL PHASES COMPLETE.

If you hit a genuine blocker you cannot resolve, write the cause to
`.claude/BLOCKED.md` and output the promise tag containing the literal
string BLOCKED.
