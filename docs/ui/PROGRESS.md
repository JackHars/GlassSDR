# GlassSDR Dedicated-UI — Progress Ledger

Single source of truth for the UI ralph-loop. Tick a box **only after** the gate
(foundations §7) passes and the commit lands. Do exactly one box per iteration.

## Phase A — foundations (must finish before any app screen)

- [x] A1. `theme/appThemes.ts` — typed AppId→theme registry (accent, ambient, motif)
- [x] A2. `AppScreen` scaffold — applies theme + `data-app`, header/status/body/footer
- [x] A3. Extend `glass.css` — per-app accent token wiring + ambient mesh tint hook
- [x] A4. Kit: `GlassPanel` / `GlassCard`
- [x] A5. Kit: `StatReadout` + `Gauge` (needle/arc, peak-hold)
- [x] A6. Kit: `DecoderFeed` + `FieldInspector` (virtualized, flash-in, expand)
- [x] A7. Kit: `EntityMap` (generalize `AircraftMap`) + detail card
- [x] A8. Kit: `ProgressiveImage` (top-down line paint, scanline motif, save)
- [x] A9. Kit: `Composer` + `ArmConsole` (wraps existing arm/disarm + LegalBanner)
- [x] A10. Kit: `Timeline`, `FrequencyDial`/`Keypad`, `EmptyState`, `HeroPanel`

## Phase B — app screens (one per iteration)

### Receivers
- [x] nfm_audio · [x] wfm_rx · [x] am_rx · [x] usb_rx+lsb_rx (one component) · [ ] cw_rx · [ ] rds_rx · [ ] adsb_rx · [ ] adsb_rx_ext

### Digital
- [ ] aprs_rx · [ ] ais_rx · [ ] acars_rx · [ ] pocsag_rx · [ ] flex_rx · [ ] afsk_rx · [ ] dmr_rx · [ ] dpmr_rx · [ ] p25_rx · [ ] nxdn_rx · [ ] tetra_rx · [ ] pager_aggregator

### Sensors
- [ ] ert_rx · [ ] weather_rx · [ ] sonde_rx · [ ] sonde_rx_ext · [ ] tpms_rx · [ ] two_tone_rx · [ ] dsc_rx · [ ] epirb_rx · [ ] ctcss_dcs

### Satellite
- [ ] apt_rx · [ ] hrpt_rx · [ ] lrpt_rx · [ ] dab_rx

### Transmit
- [ ] pocsag_tx · [ ] rtty_tx · [ ] sstv_tx · [ ] afsk_tx · [ ] morse_tx · [ ] soundboard_tx · [ ] flex_tx · [ ] sig_gen · [ ] spectrum_painter

### Testing (hazard)
- [ ] adsb_tx · [ ] gps_sim · [ ] mdc1200_tx · [ ] replay_tx · [ ] ook_editor_tx · [ ] freq_hopper · [ ] btle_tx · [ ] nrf24_tx · [ ] rfm69_tx · [ ] flipper_tx · [ ] keyfob_tx · [ ] lge_tx

### Analysis
- [ ] scanner · [ ] recon · [ ] looking_glass · [ ] ook_analyzer · [ ] ook_decoders · [ ] sub_ghz_capture · [ ] signal_meter · [ ] freq_counter · [ ] btle_rx · [ ] btle_comm · [ ] nrf24_rx · [ ] encoder_suite · [ ] decoder_suite · [ ] capture_manager · [ ] rf_characterize · [ ] protocol_analyzer · [ ] iq_player · [ ] sdr_benchmark

### Tools
- [ ] freq_manager · [ ] playlist · [ ] settings · [ ] calculator · [ ] notepad · [ ] band_plan · [ ] antenna_calc · [ ] remote_control · [ ] morse_trainer · [ ] recordings

---

**Counts:** Phase A = 10 tasks · Phase B = 83 app screens (8+12+9+4+9+12+18+10
= 82 boxes; usb_rx+lsb_rx is one box covering two app ids → 83 apps).

When every box above is ticked, the gate has passed for each, and all commits are
on the `ui-redesign` branch: emit the promise containing the literal string
**`ALL SCREENS COMPLETE`**.
