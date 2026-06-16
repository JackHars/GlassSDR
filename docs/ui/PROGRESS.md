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
- [x] nfm_audio · [x] wfm_rx · [x] am_rx · [x] usb_rx+lsb_rx (one component) · [x] cw_rx · [x] rds_rx · [x] adsb_rx · [x] adsb_rx_ext

### Digital
- [x] aprs_rx · [x] ais_rx · [x] acars_rx · [x] pocsag_rx · [x] flex_rx · [x] afsk_rx · [x] dmr_rx · [x] dpmr_rx · [x] p25_rx · [x] nxdn_rx · [x] tetra_rx · [x] pager_aggregator

### Sensors
- [x] ert_rx · [x] weather_rx · [x] sonde_rx · [x] sonde_rx_ext · [x] tpms_rx · [x] two_tone_rx · [x] dsc_rx · [x] epirb_rx · [x] ctcss_dcs

### Satellite
- [x] apt_rx · [x] hrpt_rx · [x] lrpt_rx · [x] dab_rx

### Transmit
- [x] pocsag_tx · [x] rtty_tx · [x] sstv_tx · [x] afsk_tx · [x] morse_tx · [x] soundboard_tx · [x] flex_tx · [x] sig_gen · [x] spectrum_painter

### Testing (hazard)
- [x] adsb_tx · [x] gps_sim · [x] mdc1200_tx · [x] replay_tx · [ ] ook_editor_tx · [ ] freq_hopper · [ ] btle_tx · [ ] nrf24_tx · [ ] rfm69_tx · [ ] flipper_tx · [ ] keyfob_tx · [ ] lge_tx

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
