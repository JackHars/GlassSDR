# GlassSDR — Per-App Screen Specs (83 apps)

Read [`00-foundations.md`](./00-foundations.md) first. Each entry below is a
**design brief**, not code. Per entry:

- **route** — the view file to rebuild (`frontend/src/apps/…`).
- **base** — archetype A–G from foundations §6.
- **data** — the IPC event(s)/command(s) to reuse. **Verify the exact event name
  and payload fields in `crates/mayhem-apps/src/<id>.rs` before building.** If an
  app emits no dedicated event yet, design a strong idle/empty state and drive
  the screen from `app_status` + `spectrum` only — do not fabricate data.
- **palette** — accent + ambient direction (route through the theme registry).
- **hero** — the one signature visual.
- **notes** — layout, motif, states, and reuse cluster.

Legend for shared clusters: 🧩 = build on a shared inner component with the
others in its cluster (reuse, don't duplicate).

---

## Receivers

### nfm_audio — NFM Audio
- **route** `apps/nfm-audio/NfmAudioApp.tsx` · **base** A
- **data** `spectrum`, `audio`, `app_status`; `start_app("nfm_audio", NfmTuning)`
- **palette** voice amber→gold
- **hero** live `Waterfall` with a draggable channel-filter overlay; a chunky
  **squelch meter** rail beside it that visibly gates the audio.
- **notes** Channel-centric: big mono freq readout, squelch threshold vs. signal
  bar, AudioSink + RecordBar(wav). Motif: VU-style audio bars. 🧩 demod cluster
  (nfm/wfm/am/ssb/cw) shares the tuned-audio frame; identity differs by hero.

### wfm_rx — Wideband FM
- **route** `apps/wfm-rx/WfmRxApp.tsx` · **base** A · **data** `spectrum`,`audio`,`app_status`; `WfmTuning`
- **palette** broadcast indigo→magenta
- **hero** stereo `Waterfall` + a **stereo pilot / L-R balance** indicator and an
  RDS station strip (PS/RT) docked under the waterfall when present.
- **notes** Presets for common FM stations; stereo toggle as a lit pill. Motif:
  broadcast-tower waves. 🧩 demod cluster.

### am_rx — AM Receiver
- **route** `apps/am-rx/AmRxApp.tsx` · **base** A · **data** `spectrum`,`audio`,`app_status`; `AmTuning`
- **palette** warm gold
- **hero** `Waterfall` + **carrier-level / envelope** scope; band quick-jump
  chips (Airband 118–137, MW 530–1700 kHz, SW).
- **notes** AM envelope motif. 🧩 demod cluster.

### usb_rx / lsb_rx — USB & LSB Receiver (one component)
- **route** `apps/ssb-rx/SsbRxApp.tsx` (props `appId`,`label`) · **base** A
- **data** `spectrum`,`audio`,`app_status`; `SsbTuning`
- **palette** HF amber; LSB tinted slightly cooler than USB to distinguish modes
- **hero** `Waterfall` with a **single-sideband filter skirt** drawn on the
  correct side (upper vs lower) + BFO/clarifier dial.
- **notes** One component, mode-aware identity (sideband on the correct edge,
  label, default band). Ham-band quick chips. Motif: tuning dial.

### cw_rx — CW Receiver
- **route** `apps/cw-rx/CwRxApp.tsx` · **base** A · **data** `spectrum`,`audio`,`app_status`
- **palette** amber/gold, high-contrast
- **hero** narrow `Waterfall` zoomed tight + a **live Morse decode ticker** and a
  tone-pitch / filter-width control styled like a CW filter.
- **notes** Mono decode ribbon; keyer-tone pitch slider. Motif: dit/dah marks.

### rds_rx — RDS Decoder
- **route** `apps/rds-rx/RdsRxApp.tsx` · **base** A+C · **data** `rds_data` (RdsData), `spectrum`,`audio`
- **palette** broadcast indigo→magenta
- **hero** a **car-radio faceplate**: PS station name in segment-style type,
  scrolling RadioText, PTY badge, PI code, TP/TA lamps.
- **notes** Faceplate is the centerpiece; small waterfall secondary. Motif:
  dot-matrix display. States: searching → locked.

### adsb_rx — ADS-B Receiver
- **route** `apps/adsb-rx/AdsbRxApp.tsx` · **base** B · **data** `aircraft_state` (AircraftState); `start_adsb`
- **palette** aviation sky→emerald
- **hero** `EntityMap` of aircraft with heading icons + trails; selecting a plane
  opens a detail card (callsign, alt, speed, squawk).
- **notes** Range-ring radar motif, "N aircraft" live count. Keep RecordBar(jsonl).
  🧩 ADS-B cluster with adsb_rx_ext.

### adsb_rx_ext — ADS-B Extended
- **route** `apps/adsb-ext/AdsbExtApp.tsx` · **base** B · **data** `aircraft_state` (+ extended fields — verify)
- **palette** aviation, deeper/richer than base ADS-B
- **hero** same map, but with an **altitude ladder + flight-path history panel**
  and an aircraft-type/database lookup row in the detail card.
- **notes** Adds a per-aircraft timeline of position history. 🧩 ADS-B cluster.

---

## Digital

### aprs_rx — APRS Receiver
- **route** `apps/aprs-rx/AprsRxApp.tsx` · **base** B · **data** `aprs_packet` (AprsPacketEvent)
- **palette** amber/orange (ham)
- **hero** `EntityMap` of stations with APRS symbol glyphs + a messages/bulletins
  feed beside it.
- **notes** Station detail: callsign-SSID, comment, path. Motif: packet bursts.

### ais_rx — AIS Receiver
- **route** `apps/ais-rx/AisRxApp.tsx` · **base** B · **data** `ais_ship` (AisShipEvent)
- **palette** maritime navy→cyan
- **hero** a **marine chart** `EntityMap`: vessel triangles oriented to course,
  speed-scaled vectors; detail card with MMSI, name, type, nav status.
- **notes** Sonar-sweep motif; sea-tinted ambient. Vessel list sortable by range.

### acars_rx — ACARS Decoder
- **route** `apps/acars-rx/AcarsRxApp.tsx` · **base** C · **data** `acars_message` (AcarsMessageEvent)
- **palette** aviation teal
- **hero** `DecoderFeed` of datalink messages; Inspector decodes label, flight,
  registration, OOOI event, free text.
- **notes** Group by aircraft registration; airline/label chips. Motif: flight-strip card.

### pocsag_rx — POCSAG Receiver
- **route** `apps/pocsag-rx/PocsagRxApp.tsx` · **base** C · **data** `pocsag_page` (PocsagPageEvent: ric, function, message)
- **palette** paging pink→rose
- **hero** messages rendered as **pager slips** (perforated-edge cards): capcode +
  function badge + message in pager LCD type, timestamped.
- **notes** Numeric vs alphanumeric styled differently. Motif: torn-paper edge +
  LCD. 🧩 paging cluster (pocsag/flex/pager_aggregator).

### flex_rx — FLEX Receiver
- **route** `apps/flex-rx/FlexRxApp.tsx` · **base** C · **data** `flex_page` (FlexPageEvent)
- **palette** paging rose, cooler than POCSAG
- **hero** pager-slip feed like POCSAG, plus a **baud/phase indicator**
  (1600/3200/6400) as a lit segmented bar.
- **notes** Show frame/phase metadata. 🧩 paging cluster.

### afsk_rx — AFSK Decoder
- **route** `apps/afsk-rx/AfskRxApp.tsx` · **base** C · **data** `afsk_bits` (AfskBitEvent)
- **palette** signal-green on graphite
- **hero** a **dual hex+ASCII byte stream** with a live **bit/scope eye** strip
  above it; mark/space tones visualized.
- **notes** Baud + Bell-202 preset controls. Motif: sine mark/space.

### dmr_rx — DMR Receiver
- **route** `apps/dmr-rx/DmrRxApp.tsx` · **base** C · **data** `digital_voice` (DigitalVoiceEvent, filter protocol=="DMR")
- **palette** digital-voice violet→blue
- **hero** a **two-timeslot call console**: TS1/TS2 lanes showing active TG, source
  ID, call type, with a rolling call log below.
- **notes** "Unencrypted only" inline note. 🧩 **digital-voice cluster** — build
  dmr/dpmr/p25/nxdn/tetra on ONE shared `DigitalVoiceScreen` parameterized by
  protocol label, default freq, lane model, and theme.

### dpmr_rx — dPMR Receiver
- **route** `apps/dpmr-rx/DpmrRxApp.tsx` · **base** C · **data** `digital_voice` (protocol=="dPMR")
- **palette** violet, single-lane (FDMA)
- **hero** single-channel call console + call log. 🧩 digital-voice cluster.

### p25_rx — P25 Receiver
- **route** `apps/p25-rx/P25RxApp.tsx` · **base** C · **data** `digital_voice` (protocol=="P25")
- **palette** public-safety blue with a shield motif
- **hero** call console showing NAC/talkgroup/unit; "Phase 1 unencrypted" note.
- **notes** Badge/shield motif. 🧩 digital-voice cluster.

### nxdn_rx — NXDN Receiver
- **route** `apps/nxdn-rx/NxdnRxApp.tsx` · **base** C · **data** `digital_voice` (protocol=="NXDN")
- **palette** indigo
- **hero** call console with 4800/9600 mode indicator. 🧩 digital-voice cluster.

### tetra_rx — TETRA Receiver
- **route** `apps/tetra-rx/TetraRxApp.tsx` · **base** C · **data** `digital_voice` (protocol=="TETRA")
- **palette** violet, "European" cool tone
- **hero** call console + signalling/SSI feed. 🧩 digital-voice cluster.

### pager_aggregator — Pager Aggregator
- **route** `apps/pager-agg/PagerAggApp.tsx` · **base** C · **data** `pocsag_page` + `flex_page` (+ ERMES if present — verify)
- **palette** paging magenta, multi-source
- **hero** a **unified pager feed** merging protocols, each slip tagged with a
  protocol chip + per-frequency lanes config.
- **notes** Multi-frequency config row. 🧩 paging cluster.

---

## Sensors

### ert_rx — ERT Meter Reader
- **route** `apps/ert-rx/ErtRxApp.tsx` · **base** C · **data** `ert_meter` (ErtMeterEvent)
- **palette** utility slate + signal-green
- **hero** a **utility-meter dashboard**: cards per meter (ID, type elec/gas/water
  icon, consumption) with a per-meter mini history sparkline.
- **notes** Group by meter type. Motif: dial/odometer digits.

### weather_rx — Weather Station
- **route** `apps/weather-rx/WeatherRxApp.tsx` · **base** C/F · **data** `weather_reading` (WeatherEvent)
- **palette** sky blue
- **hero** a **weather console**: large temp/humidity/rain tiles per sensor with
  trend sparklines and a "last seen" pulse.
- **notes** Sensor cards keyed by id/channel. Motif: sun-behind-cloud.

### sonde_rx — Radiosonde RX
- **route** `apps/sonde-rx/SondeRxApp.tsx` · **base** B · **data** `sonde_telemetry` (SondeEvent)
- **palette** violet/upper-atmosphere
- **hero** `EntityMap` with the balloon track + a **telemetry stack** (alt, climb
  rate, temp, humidity, pressure, GPS) and an altitude-vs-time plot.
- **notes** Sonde type (RS41/RS92/DFM) badge. 🧩 sonde cluster with ext.

### sonde_rx_ext — Radiosonde Extended
- **route** `apps/sonde-rx-ext/SondeRxExtApp.tsx` · **base** B · **data** `sonde_telemetry` (+ prediction fields — verify)
- **palette** violet, deeper
- **hero** same map + a **predicted flight path + landing-zone** marker and burst-
  altitude estimate panel.
- **notes** Descent/landing prediction is the differentiator. 🧩 sonde cluster.

### tpms_rx — TPMS Decoder
- **route** `apps/tpms-rx/TpmsRxApp.tsx` · **base** C/F · **data** `tpms_sensor` (TpmsSensorEvent)
- **palette** automotive graphite + amber alert
- **hero** a **car top-view with four wheels**; each wheel tile shows pressure +
  temperature, turning amber/red on low pressure; unknown sensors list aside.
- **notes** PSI/kPa unit toggle. Motif: tire tread.

### two_tone_rx — Two-Tone Paging
- **route** `apps/twotone-rx/TwoToneRxApp.tsx` · **base** C · **data** `two_tone_alert` (TwoToneEvent)
- **palette** emergency red→orange
- **hero** a **dispatch alert log**: each detected A/B tone pair as an alarm card
  with tone freqs, timing, and timestamp; newest flashes.
- **notes** Fire/EMS dispatch feel. Motif: siren pulse. Emergency identity.

### dsc_rx — DSC Decoder
- **route** `apps/dsc-rx/DscRxApp.tsx` · **base** B/C · **data** `dsc_message` (DscMessageEvent)
- **palette** maritime navy; distress messages flip to emergency red
- **hero** a **DSC message feed** with category badges (Distress/Urgency/Safety/
  Routine); distress messages elevate with MMSI + position (optional map pin).
- **notes** Ch70 (156.525) context. Motif: anchor + alarm.

### epirb_rx — EPIRB Decoder
- **route** `apps/epirb-rx/EpirbRxApp.tsx` · **base** B · **data** `epirb_beacon` (EpirbBeaconEvent)
- **palette** emergency red (distress)
- **hero** a **distress console**: large pulsing beacon card with hex beacon ID,
  country, beacon type, and decoded GPS plotted on a small map.
- **notes** This is a life-safety screen — sober, high-contrast, unmistakable.
  Motif: SOS pulse.

### ctcss_dcs — CTCSS/DCS Scanner
- **route** `apps/ctcss-dcs/CtcssDcsApp.tsx` · **base** A/C · **data** `ctcss_detect` (CtcssDetectEvent)
- **palette** signal-green
- **hero** a **tone wheel**: the detected CTCSS tone (67–254.1 Hz) or DCS code
  highlighted on a radial scale, with a history list of detections.
- **notes** Tuning-fork motif. Show tone table reference.

---

## Satellite

### apt_rx — NOAA APT
- **route** `apps/apt-rx/AptRxApp.tsx` · **base** D · **data** `apt_line` (AptLineEvent), `spectrum`
- **palette** cosmic indigo→cyan
- **hero** `ProgressiveImage` painting the APT image **line-by-line top-down**;
  pass info sidebar (satellite, elevation, signal).
- **notes** Scanline motif; channel A/B split toggle. 🧩 imaging cluster.

### hrpt_rx — HRPT Receiver
- **route** `apps/hrpt-rx/HrptRxApp.tsx` · **base** D · **data** verify (likely `apt_line`-style or spectrum only)
- **palette** cosmic, richer/HD
- **hero** `ProgressiveImage` high-res with a **channel/band selector** (multi-
  spectral) and dish-pointing/signal panel.
- **notes** "Requires dish" note. 🧩 imaging cluster.

### lrpt_rx — Meteor LRPT
- **route** `apps/lrpt-rx/LrptRxApp.tsx` · **base** D · **data** verify
- **palette** cosmic indigo
- **hero** `ProgressiveImage` (digital, cleaner than APT) + QPSK lock/SNR meter.
- **notes** Meteor-M context. 🧩 imaging cluster.

### dab_rx — DAB Radio
- **route** `apps/dab-rx/DabRxApp.tsx` · **base** A/C · **data** `dab_service` (DabServiceEvent), `audio`
- **palette** broadcast indigo→magenta
- **hero** an **ensemble browser**: list of services in the multiplex as station
  cards; selecting one shows now-playing + plays audio.
- **notes** Digital-radio identity, distinct from analog faceplates. AudioSink.

---

## Transmit

> All TX apps: keep the arm/disarm + `LegalBanner` gate via `ArmConsole`. Identity =
> hazard-aware: amber when armed, breathing red when transmitting, neutral idle.
> Data: `tx_status` / `pocsag_tx_status` (TxStatus) + `start_app` params.

### pocsag_tx — POCSAG Transmitter
- **route** `apps/pocsag-tx/PocsagTxApp.tsx` · **base** E · **data** `pocsag_tx_status`; `PocsagTxParams`
- **palette** paging rose + TX hazard
- **hero** `Composer` for capcode + function + message with a **live POCSAG frame
  preview** (preamble/sync/BCH) and the `ArmConsole` transmit stage.
- **notes** Baud 512/1200/2400 selector. Reference build (already richest TX).

### rtty_tx — RTTY Transmitter
- **route** `apps/rtty-tx/RttyTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** amber teletype
- **hero** text `Composer` + a **Baudot/mark-space FSK preview** waveform; baud
  (45.45) + shift (170 Hz) dials.
- **notes** Teletype motif (monospace, carriage feel).

### sstv_tx — SSTV Transmitter
- **route** `apps/sstv-tx/SstvTxApp.tsx` · **base** D+E · **data** `tx_status`
- **palette** photographic violet + TX hazard
- **hero** image picker + a **ProgressiveImage encode preview** that paints the
  image as it would transmit, with the SSTV mode (Scottie/Martin) selector.
- **notes** Marries imaging + TX. Scanline motif during TX.

### afsk_tx — AFSK Transmitter
- **route** `apps/afsk-tx/AfskTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** signal-green + hazard
- **hero** payload `Composer` (text/hex) + mark/space tone preview + baud config.
- **notes** Mirror afsk_rx visual language (sine mark/space).

### morse_tx — Morse Transmitter
- **route** `apps/morse-tx/MorseTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** amber/gold + hazard
- **hero** text `Composer` with a **live dit/dah timeline** of the encoded message
  + a WPM dial styled like a CW key.
- **notes** Telegraph paddle motif.

### soundboard_tx — Audio Transmitter
- **route** `apps/soundboard-tx/SoundboardTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** indigo + hazard
- **hero** source picker (file / mic) + **FM deviation meter** + level VU; carrier
  freq dial.
- **notes** Broadcast-mic motif.

### flex_tx — FLEX Transmitter
- **route** `apps/flex-tx/FlexTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** paging rose + hazard
- **hero** capcode + message `Composer` + FLEX frame/baud preview (1600/3200/6400).
- **notes** Pair visually with flex_rx.

### sig_gen — Signal Generator
- **route** `apps/sig-gen/SigGenApp.tsx` · **base** E/F · **data** `tx_status`
- **palette** instrument cyan + hazard
- **hero** a **lab signal-generator instrument**: big frequency dial, power
  (dBm) knob, mode (CW/sweep/mod) — styled like bench RF gear.
- **notes** Sweep params reveal a mini timeline. Instrument-panel motif.

### spectrum_painter — Spectrum Painter
- **route** `apps/spectrum-painter/SpectrumPainterApp.tsx` · **base** E · **data** `tx_status`
- **palette** magenta paint + hazard
- **hero** image/text input + a **preview of how it will look on a waterfall**
  (render the painted spectrum), bandwidth + center controls.
- **notes** Paintbrush motif; the preview is the wow-factor.

---

## Testing (dual-use)

> Identity: **hazard**. Diagonal amber/charcoal chevron motif on the header, an
> explicit scope banner ("FOR TESTING ONLY" / "SHIELDED USE ONLY" / "AUTHORIZED
> USE ONLY" — pull the exact copy from the app description), and the `ArmConsole`
> gate. Sober, deliberate, never playful.

### adsb_tx — ADS-B Spoofer
- **route** `apps/adsb-tx/AdsbTxApp.tsx` · **base** E+B · **data** `tx_status`
- **palette** hazard amber over aviation
- **hero** a **fake-aircraft editor on a map**: place callsign/ICAO/alt/speed/pos,
  preview the phantom plane on a mini map, then arm+transmit on 1090.
- **notes** Strong "TESTING ONLY" banner. Map preview ties it to adsb_rx.

### gps_sim — GPS Simulator
- **route** `apps/gps-sim/GpsSimApp.tsx` · **base** E+F · **data** `tx_status`
- **palette** hazard red (high-risk)
- **hero** a **target-location picker** (lat/lon/alt) on a map + a **satellite
  constellation/skyplot** of simulated SVs; prominent "SHIELDED USE ONLY".
- **notes** Crosshair motif. Highest-caution styling.

### mdc1200_tx — MDC1200 Encoder
- **route** `apps/mdc1200-tx/Mdc1200TxApp.tsx` · **base** E · **data** `tx_status`
- **palette** hazard amber
- **hero** unit-ID + op-type (PTT-ID / emergency / call alert) `Composer` with a
  **burst-tone preview**.
- **notes** Megaphone motif.

### replay_tx — Signal Replay
- **route** `apps/replay-tx/ReplayTxApp.tsx` · **base** E+G · **data** `tx_status`; `list_recordings`/IQ files
- **palette** hazard violet
- **hero** an IQ-capture picker (reuse recordings list) + a **transport bar**
  (waveform/▶) + replay freq/sample-rate; transmitLabel "REPLAY".
- **notes** Tape-transport motif.

### ook_editor_tx — OOK Editor
- **route** `apps/ook-editor-tx/OokEditorTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** hazard blue
- **hero** a **bit-by-bit OOK waveform editor**: click cells to toggle on/off,
  set pulse width + symbol rate, see the square-wave render update live.
- **notes** The editable pulse train is the hero. Motif: square wave.

### freq_hopper — Frequency Hopper
- **route** `apps/freq-hopper/FreqHopperApp.tsx` · **base** E+G · **data** `tx_status`
- **palette** hazard cyan
- **hero** a **hop-sequence `Timeline`**: editable list of freqs with dwell times
  animating as a moving playhead across a spectrum band.
- **notes** Zigzag-hop motif.

### btle_tx — BLE Transmitter
- **route** `apps/btle-tx/BtleTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** bluetooth blue + hazard
- **hero** advertisement builder (MAC, AdvData hex, interval) + **BLE channel
  (37/38/39) selector** lit on a 2.4 GHz strip.
- **notes** Bluetooth glyph motif. 🧩 2.4 GHz cluster (btle/nrf24/rfm69 share the
  channel-strip + payload-builder pattern).

### nrf24_tx — NRF24 Transmitter
- **route** `apps/nrf24-tx/Nrf24TxApp.tsx` · **base** E · **data** `tx_status`
- **palette** cyan + hazard
- **hero** channel + address + payload + data-rate builder over a **2.4 GHz
  channel map**; chip/IC motif.
- **notes** 🧩 2.4 GHz cluster.

### rfm69_tx — RFM69 Transmitter
- **route** `apps/rfm69-tx/Rfm69TxApp.tsx` · **base** E · **data** `tx_status`
- **palette** teal + hazard
- **hero** freq + node/network ID + payload builder; **module-pinout** motif.
- **notes** 🧩 2.4 GHz/ISM module cluster.

### flipper_tx — Flipper Emulator
- **route** `apps/flipper-tx/FlipperTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** Flipper orange + hazard
- **hero** a **.sub file dropzone** that parses & shows the capture's freq +
  modulation + protocol, then an arm+replay stage.
- **notes** Dolphin/playful-but-cautious; keep hazard discipline.

### keyfob_tx — Keyfob Emulator
- **route** `apps/keyfob-tx/KeyfobTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** hazard amber (authorized-use)
- **hero** vehicle-protocol picker + 315/433 MHz selector + rolling-code params;
  a **keyfob graphic** with lock/unlock/trunk buttons. Strong "AUTHORIZED USE".
- **notes** Car-key motif.

### lge_tx — LGE / LoRa Transmitter
- **route** `apps/lge-tx/LgeTxApp.tsx` · **base** E · **data** `tx_status`
- **palette** green + hazard
- **hero** LoRa params (spreading factor, bandwidth, coding rate) as a **link-
  budget style panel** + payload; gateway/house-antenna motif.
- **notes** Show resulting data-rate from SF/BW.

---

## Analysis

### scanner — Frequency Scanner
- **route** `apps/scanner/ScannerApp.tsx` · **base** G · **data** `scan_result` (ScanResultEvent), `spectrum`
- **palette** analysis graphite + scan-green
- **hero** a **scanning band view**: range bar with a sweeping playhead that
  "locks" and stops on active hits; hit list with freq + level + time.
- **notes** Start/stop/step controls; lock animation. Motif: magnifier sweep.

### recon — Recon Scanner
- **route** `apps/recon/ReconApp.tsx` · **base** G · **data** `scan_result` (+ logging)
- **palette** graphite + amber (recon)
- **hero** a **signal-activity log/heatmap**: frequency vs time grid of detections
  with strength, plus a logged-hits table and frequency-DB import.
- **notes** Pattern-detection emphasis; denser than scanner. 🧩 scan cluster.

### looking_glass — Spectrum Panorama
- **route** `apps/looking-glass/LookingGlassApp.tsx` · **base** G · **data** `spectrum` (wide sweep)
- **palette** analysis indigo
- **hero** a **wide panoramic spectrum + waterfall** spanning a large range, with
  range/markers and a peak list.
- **notes** Full-bleed hero; min chrome. Motif: panorama bars.

### ook_analyzer — OOK Analyzer
- **route** `apps/ook-analyzer/OokAnalyzerApp.tsx` · **base** G · **data** `pulse_event` (PulseEventIpc)
- **palette** graphite + amber
- **hero** a **pulse-timing diagram**: captured OOK pulses drawn as a logic-
  analyzer trace, with measured pulse/gap widths and inferred bit pattern.
- **notes** Logic-analyzer motif. 🧩 OOK cluster with editor/decoders.

### ook_decoders — OOK Decoders
- **route** `apps/ook-decoders/OokDecodersApp.tsx` · **base** C/G · **data** `ook_decode` (OokDecodeEvent)
- **palette** signal-green
- **hero** decoded-device feed: protocol (PT2262/EV1527/…), device code, button,
  with an auto-detect vs select-protocol toggle.
- **notes** 🧩 OOK cluster.

### sub_ghz_capture — Sub-GHz Capture
- **route** `apps/subghz-capture/SubGhzCaptureApp.tsx` · **base** G · **data** `spectrum`; recording cmds
- **palette** cyan capture
- **hero** waterfall + a **prominent record transport** (arm/record/elapsed/size)
  writing IQ; recent captures list.
- **notes** Center freq + sample rate; ties into Capture Manager/IQ Player.

### signal_meter — Signal Meter
- **route** `apps/signal-meter/SignalMeterApp.tsx` · **base** F · **data** `spectrum`/power, `app_status`
- **palette** instrument amber on dark glass
- **hero** a **classic analog S-meter** (`Gauge` needle) with peak-hold + a dBm
  history strip-chart below.
- **notes** The needle is the star. Motif: backlit meter.

### freq_counter — Frequency Counter
- **route** `apps/freq-counter/FreqCounterApp.tsx` · **base** F · **data** `freq_measure` (FreqMeasureEvent)
- **palette** instrument cyan
- **hero** a **big nixie/7-segment frequency display** (Hz precision) with a
  stability/lock indicator and a small recent-reading log.
- **notes** Lab counter identity. Motif: segmented digits.

### btle_rx — BLE Scanner
- **route** `apps/btle-rx/BtleRxApp.tsx` · **base** C · **data** `ble_adv` (BleAdvEvent)
- **palette** bluetooth blue
- **hero** discovered-device feed: cards with MAC, name, RSSI bars, last-seen,
  channel; sort by RSSI. RSSI proximity motif.
- **notes** 🧩 BLE cluster with btle_comm.

### btle_comm — BLE Communicator
- **route** `apps/btle-comm/BtleCommApp.tsx` · **base** F · **data** `ble_adv` + GATT cmds (verify)
- **palette** bluetooth blue, deeper
- **hero** a **GATT explorer tree**: device → services → characteristics, with
  read/write/notify panes (an inspector-style master/detail).
- **notes** 🧩 BLE cluster.

### nrf24_rx — NRF24 Sniffer
- **route** `apps/nrf24-rx/Nrf24RxApp.tsx` · **base** C · **data** verify (likely a packet event)
- **palette** cyan
- **hero** captured-packet feed with address/channel/payload hex + a **2.4 GHz
  channel-activity strip** (mirrors nrf24_tx map).
- **notes** Mice/keyboards/drones context.

### encoder_suite — Encoder Suite
- **route** `apps/encoder-suite/EncoderSuiteApp.tsx` · **base** E/F · **data** `tx_status`
- **palette** tool blue + hazard when transmitting
- **hero** a **tabbed signal-bench**: DTMF / two-tone / five-tone, each with its
  own keypad/param panel and a tone preview.
- **notes** 🧩 pairs with decoder_suite as a matched encode/decode set.

### decoder_suite — Multi-Protocol RX
- **route** `apps/decoder-suite/DecoderSuiteApp.tsx` · **base** C · **data** multiple (enable per decoder — verify)
- **palette** layered multi-color (one accent per enabled protocol)
- **hero** a **multi-lane decode feed**: toggle decoders on/off, each contributes
  color-tagged rows to one unified stream on a single frequency.
- **notes** Layers motif. Reuse `DecoderFeed` with source tags.

### capture_manager — Capture Manager
- **route** `apps/capture-manager/CaptureManagerApp.tsx` · **base** F · **data** `list_recordings`, `delete_recording`
- **palette** archival violet
- **hero** an **IQ-capture library**: grid/list of captures with date, freq,
  duration, size + a spectrum thumbnail preview; actions to open in player/replay.
- **notes** Reuse RecordingsPanel patterns; file-card motif.

### rf_characterize — RF Characterization
- **route** `apps/rf-char/RfCharApp.tsx` · **base** G/F · **data** `spectrum` (+ measured params — verify)
- **palette** instrument graphite
- **hero** a **measurement report card**: bandwidth, modulation type (FM/AM/PSK/
  FSK), symbol rate, deviation — each a `StatReadout`, fed by a live capture.
- **notes** Ruler/measure motif.

### protocol_analyzer — Protocol Analyzer
- **route** `apps/protocol-analyzer/ProtocolAnalyzerApp.tsx` · **base** G · **data** capture + decode (verify)
- **palette** forensic ink/graphite
- **hero** a **packet dissector**: byte/hex pane on the left, an annotated
  field-tree on the right (Wireshark-like), protocol-family selector on top.
- **notes** The annotated deframing is the centerpiece. Eye/inspect motif.

### iq_player — IQ File Player
- **route** `apps/iq-player/IqPlayerApp.tsx` · **base** G · **data** `spectrum`; file load
- **palette** playback cyan
- **hero** a **media player for IQ**: file picker + transport bar (▶/⏸/scrub/speed)
  driving the waterfall; route-to-demod selector.
- **notes** Transport/play motif. Pairs with Capture Manager.

### sdr_benchmark — SDR Benchmark
- **route** `apps/sdr-bench/SdrBenchApp.tsx` · **base** F · **data** `app_status`/metrics (verify)
- **palette** instrument graphite + green/amber pass-fail
- **hero** a **benchmark dashboard**: throughput/latency/dropped-samples gauges +
  a results table across sample rates, with a run button.
- **notes** Speedometer motif.

---

## Tools

### freq_manager — Frequency Manager
- **route** `apps/freq-manager/FreqManagerApp.tsx` · **base** F
- **palette** calm blue
- **hero** a **memory-bank list**: saved frequencies as cards (label, freq, mode,
  bw, notes) with quick-tune; add/edit/group. Clean, organized.
- **notes** Reuse FrequencyInput. Notebook motif.

### playlist — TX Playlist
- **route** `apps/playlist/PlaylistApp.tsx` · **base** F+E · **data** `tx_status`
- **palette** green + hazard
- **hero** a **TX queue**: ordered steps (op + params + delay) with a run/▶ that
  walks the list, current-step highlight, and per-step status.
- **notes** Queue/playlist motif. Honors arm gate per step.

### settings — Settings
- **route** `apps/settings/SettingsApp.tsx` · **base** F · **data** `list_usb_devices`, settings cmds (verify)
- **palette** neutral system
- **hero** a **settings panel**: grouped sections (Hardware: bias-T, clock, PPM
  correction; UI prefs) with the device selector + connection status.
- **notes** Gear motif; native-settings calm. Toggles/sliders from the kit.

### calculator — RF Calculator
- **route** `apps/calculator/CalculatorApp.tsx` · **base** F
- **palette** tool violet
- **hero** an **RF engineering pad**: wavelength / FSPL / link-budget / unit
  convert as live-updating cards (no Calculate button — compute on input), with a
  standard-expression mode tab.
- **notes** Already decent; elevate to instrument quality. Mono results.

### notepad — Notepad
- **route** `apps/notepad/NotepadApp.tsx` · **base** F
- **palette** paper amber, warm
- **hero** a **paper-like note surface** with autosave indicator and a small
  "insert current freq/time" helper; quiet, distraction-free.
- **notes** Paper motif; the one deliberately low-tech screen.

### band_plan — Band Plan Reference
- **route** `apps/band-plan/BandPlanApp.tsx` · **base** F
- **palette** reference blue, multi-band color coding
- **hero** a **scrollable visual band-plan ruler**: frequency axis with colored
  allocation segments (amateur/commercial/ISM/…); tap a band for details.
- **notes** Region (ITU) switcher. Spectrum-ruler motif.

### antenna_calc — Antenna Calculator
- **route** `apps/antenna-calc/AntennaCalcApp.tsx` · **base** F
- **palette** tool cyan
- **hero** an **antenna diagram that redraws to scale**: pick type (dipole/¼-wave/
  Yagi), enter freq, see element lengths/spacing labeled on the drawing.
- **notes** The live scale drawing is the hero. Tower motif.

### remote_control — Remote Control
- **route** `apps/remote-control/RemoteControlApp.tsx` · **base** F
- **palette** network violet
- **hero** a **server console**: enable toggle, address/QR to connect, optional
  password, and a live connected-clients list with activity.
- **notes** Globe/network motif. Clear on/off state.

### morse_trainer — Morse Trainer
- **route** `apps/morse-trainer/MorseTrainerApp.tsx` · **base** F
- **palette** learning amber/gold
- **hero** a **practice stage**: big dit/dah glyph, answer input, score, with a
  progressive-lesson selector and a real CW-key paddle visual that animates on
  play. (Already bespoke — polish to spec, add lessons + paddle.)
- **notes** Telegraph motif. Keep the audio oscillator logic.

### recordings — Recordings
- **route** `apps/recordings/RecordingsApp.tsx` · **base** F · **data** `list_recordings`, `delete_recording`
- **palette** archival red-accent
- **hero** a **recordings library grouped by source app**: collapsible groups,
  each item with format/size/freq/time, filter + inspect + delete; reuses the
  app icons/colors so groups are recognizable.
- **notes** Most-developed tool today; refactor onto the kit, keep grouping.

---

## Build order (suggested)

Phase A (foundations) → then Tools (fast wins: calculator, notepad, band_plan,
antenna_calc, freq_manager, settings, recordings, morse_trainer) → Receivers →
the digital-voice 🧩 cluster (one component, five themes) → the paging 🧩 cluster
→ remaining Digital → Sensors → Satellite imaging 🧩 → Analysis → Transmit →
Testing (hazard) last. Clusters get built once and themed five ways, which is
where "reuse if similar enough" pays off.
