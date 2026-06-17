import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "../../store";
import { Icon } from "../kit/Icon";

function SvgIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#007AFF" />
          <stop offset="100%" stopColor="#5856D6" />
        </linearGradient>
      </defs>
      <path d={path} fill="url(#ig)" />
    </svg>
  );
}

// SVG path data constants for each app icon
const ICON_PATHS = {
  // ---- RECEIVERS ----
  // NFM Audio: radio with speaker grille
  nfm_audio: "M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z",
  // Wideband FM: broadcast tower with waves
  wfm_rx: "M12 2L8.5 8h-3L2 22h4l1.5-5h9L18 22h4l-3.5-14h-3L12 2zm0 4l2 4H10l2-4zM5 18l1-4h12l1 4H5z",
  // AM Receiver: speaker cone
  am_rx: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.2v7.6c1-.7 2.5-2 2.5-3.8zM14 3.2v2.1a7 7 0 010 13.4v2.1A9 9 0 0014 3.2z",
  // USB Receiver: tuning dial upper
  usb_rx: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16zm-1 3v5l4 3 1-1.7-3-2.3V7h-2z",
  // LSB Receiver: tuning dial lower
  lsb_rx: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16zm1 3h-2v6H7v2h6V7z",
  // CW Receiver: lightning bolt (morse)
  cw_rx: "M13 2L3 14h7l-2 8 10-12h-7l2-8z",
  // RDS Decoder: text data overlay on radio
  rds_rx: "M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z",
  // ADS-B Receiver: airplane
  adsb_rx: "M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
  // ADS-B Extended: airplane with data lines
  adsb_rx_ext: "M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5zM2 7h4v1H2V7zm0 3h5v1H2v-1z",

  // ---- DIGITAL ----
  // APRS Receiver: map pin with signal
  aprs_rx: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z",
  // AIS Receiver: ship/vessel
  ais_rx: "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.55 4-1.5 2.52 1.9 5.48 1.9 8 0 1.26.95 2.62 1.5 4 1.5h2v2h-2zM5.67 17h12.66l-2-8H15V5h-2v4H7.67l-2 8zm1.33-6h10l1 4H6l1-4z",
  // ACARS Decoder: airplane with data
  acars_rx: "M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z",
  // POCSAG Receiver: pager device
  pocsag_rx: "M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zm0 14H7V5h10v12zM8 7h8v2H8V7zm0 3h5v2H8v-2z",
  // FLEX Receiver: pager with speed lines
  flex_rx: "M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zm0 14H7V5h10v12zM8 7h8v2H8V7zm0 3h5v2H8v-2zm-6 1h-1v2h1v-2zm0-4h-1v2h1V7z",
  // AFSK Decoder: sine wave
  afsk_rx: "M2 12c1.5-3 3-6 5-6s3.5 6 5 6 3.5-6 5-6 3.5 3 5 6",
  // DMR Receiver: digital radio handset
  dmr_rx: "M16 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2zm-4 18a1 1 0 110-2 1 1 0 010 2zm4-4H8V5h8v12z",
  // dPMR Receiver: digital radio with d badge
  dpmr_rx: "M16 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2zm0 14H8V5h8v12zM10 8h2a2 2 0 010 4h-2V8zm1 3h1a1 1 0 000-2h-1v2z",
  // P25 Receiver: police badge / shield
  p25_rx: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.06-7 10.28-3.87-1.22-7-5.61-7-10.28V6.3l7-3.12z",
  // NXDN Receiver: two-way radio with N
  nxdn_rx: "M16 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2zm0 14H8V5h8v12zM10 7v6l4-6v6",
  // TETRA Receiver: european radio tower
  tetra_rx: "M12 2l-1 4h2l-1-4zM8 8h8l2 14h-3l-1-6H10l-1 6H6l2-14zm3 2v4h2v-4h-2z",
  // Pager Aggregator: stacked pagers
  pager_aggregator: "M18 4H6a2 2 0 00-2 2v3a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zM6 8V6h12v2H6zm12 5H6a2 2 0 00-2 2v3a2 2 0 002 2h12a2 2 0 002-2v-3a2 2 0 00-2-2zM6 18v-2h12v2H6z",

  // ---- SENSORS ----
  // ERT Meter Reader: electric meter / plug
  ert_rx: "M12 2a8 8 0 00-8 8h3l-4 7h3v5h4v-5h3l-4-7h3a8 8 0 00-8-8zm-1 4h2v4h-2V6zm0 5h2v2h-2v-2z",
  // Weather Station: sun behind cloud
  weather_rx: "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM1 10.5h3v2H1v-2zm10-9.95h2V4h-2V.55zM19.04 3.04l-1.41 1.41 1.79 1.8 1.41-1.41-1.79-1.8zM20 10.5h3v2h-3v-2zM12 5.5a6 6 0 00-5.78 7.5H5a3 3 0 000 6h13a4 4 0 00.78-7.93A5.99 5.99 0 0012 5.5z",
  // Radiosonde RX: balloon with tether
  sonde_rx: "M12 2a4 4 0 00-4 4c0 2.5 2 4 4 6 2-2 4-3.5 4-6a4 4 0 00-4-4zm0 2a2 2 0 110 4 2 2 0 010-4zm-1 10h2v3h2l-3 5-3-5h2v-3z",
  // Radiosonde Extended: balloon with parachute arc
  sonde_rx_ext: "M12 2a4 4 0 00-4 4c0 2.5 2 4 4 6 2-2 4-3.5 4-6a4 4 0 00-4-4zm0 2a2 2 0 110 4 2 2 0 010-4zm-5 11c1.5-2 3.2-3 5-3s3.5 1 5 3l-2 1c-1-1.3-2-2-3-2s-2 .7-3 2l-2-1zm4 3h2v4h-2v-4z",
  // TPMS Decoder: car wheel / tire
  tpms_rx: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm11 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM5 11l1.5-4.5h11L19 11H5z",
  // Two-Tone Paging: fire truck siren
  two_tone_rx: "M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 12a2 2 0 110-4 2 2 0 010 4z",
  // DSC Decoder: anchor
  dsc_rx: "M12 2a1 1 0 00-1 1v1.07A7.97 7.97 0 004 12v1h2v-1a6 6 0 015-5.92V14a3 3 0 01-6 .34L3.06 14A5 5 0 0011 18.9V21H7v2h10v-2h-4v-2.1A5 5 0 0020.94 14L19 14.34a3 3 0 01-6-.34V6.08A6 6 0 0118 12v1h2v-1a7.97 7.97 0 00-7-7.93V3a1 1 0 00-1-1z",
  // EPIRB Decoder: SOS beacon / distress
  epirb_rx: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z",
  // CTCSS/DCS Scanner: tuning fork / tone
  ctcss_dcs: "M12 3v10.55A4 4 0 1014 17V7h4V3h-6zM10 19a2 2 0 110-4 2 2 0 010 4z",

  // ---- SATELLITE ----
  // NOAA APT: satellite
  apt_rx: "M6 6.5l4 2.5-2 1-4-2.5 2-1zm12 0l-4 2.5 2 1 4-2.5-2-1zM12 2L1.5 9 12 16l10.5-7L12 2zm0 16.5l-7-4.67v4.34L12 22l7-3.83v-4.34L12 18.5z",
  // HRPT Receiver: satellite dish
  hrpt_rx: "M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2zm0 4a6 6 0 016 6h-2a4 4 0 00-4-4V6zm0 4a2 2 0 012 2h-2v-2zM3.5 18.5l5-5a2.5 2.5 0 013.5 0c1 1 1 2.5 0 3.5l-5 5c-1 1-2.5 1-3.5 0s-1-2.5 0-3.5z",
  // Meteor LRPT: meteor / comet
  lrpt_rx: "M2 2l3 3-1 1 4 4 1.5-1.5L15 14l-5.5 5.5L8 18l-4-4-1 1-3-3 2 1 2-2L2 9l2 2 2-2-2-2zm8 6l6 6 6-6-3-3-3 3-3-3-3 3z",
  // DAB Radio: digital radio
  dab_rx: "M20 6H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2zm-8 10a4 4 0 110-8 4 4 0 010 8zm6-6h-2V8h2v2zm0 4h-2v-2h2v2z",

  // ---- TRANSMIT ----
  // POCSAG Transmitter: pager outgoing
  pocsag_tx: "M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zM7 17V5h10v12H7zm13-9h2v2h-2V8zm0 3h3v2h-3v-2z",
  // RTTY Transmitter: teletype keyboard
  rtty_tx: "M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2zM8 17H4v-2h4v2zm0-4H4v-2h4v2zm0-4H4V7h4v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2z",
  // SSTV Transmitter: image frame
  sstv_tx: "M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H3V5h18v14zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
  // AFSK Transmitter: broadcast sine wave
  afsk_tx: "M12 12l-4-4H3v8h5l4-4zm4.5 0A4.5 4.5 0 0014 8.2v7.6c1-.7 2.5-2 2.5-3.8zM14 3.2v2.1a7 7 0 010 13.4v2.1A9 9 0 0014 3.2z",
  // Morse Transmitter: morse key
  morse_tx: "M7 8a2 2 0 00-2 2v2H3v4h18v-4h-2v-2a2 2 0 00-2-2H7zm0 2h10v2H7v-2zM2 18h20v2H2v-2z",
  // Audio Transmitter: music note broadcast
  soundboard_tx: "M12 3v10.55A4 4 0 1014 17V7h4V3h-6zm6 14l2-2v4l-2-2zm2-6l2-2v8l-2-2v-4z",
  // FLEX Transmitter: pager with send arrow
  flex_tx: "M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zM7 17V5h10v12H7zm14-8l-3 3v-2h-2V8h2V6l3 3z",
  // Signal Generator: waveform
  sig_gen: "M2 12h2l2-4 3 8 3-10 3 12 2-6h5",
  // Spectrum Painter: paintbrush
  spectrum_painter: "M7 14c-1.66 0-3 1.34-3 3s1.34 3 3 3c.55 0 1.08-.15 1.53-.42L21 9.5l-1-1-5.5 3.14L9.91 8.5 7 14zm0 4a1 1 0 110-2 1 1 0 010 2z",

  // ---- TESTING ----
  // ADS-B Spoofer: airplane with warning
  adsb_tx: "M12 2L8 8H3l-1 2 8 5v5l-2 1.5V23l3.5-1 3.5 1v-1.5L13 20v-5l8-5-1-2h-5L12 2zm7 7h2v2h-2V9zm0 3h2v1h-2v-1z",
  // GPS Simulator: crosshair on map
  gps_sim: "M12 8a4 4 0 100 8 4 4 0 000-8zm-9 3H1v2h2a9 9 0 008 8v2h2v-2a9 9 0 008-8h2v-2h-2a9 9 0 00-8-8V1h-2v2a9 9 0 00-8 8zm9-7a7 7 0 110 14 7 7 0 010-14z",
  // MDC1200 Encoder: megaphone
  mdc1200_tx: "M18 11v2h4v-2h-4zM16 7.41L17.41 6l2.83 2.83-1.41 1.41L16 7.41zm1.41 9.18L16 16.59l2.83-2.83 1.41 1.42-2.83 2.82zM2 11l6-4v3h6v2H8v3l-6-4z",
  // Signal Replay: replay circular arrow
  replay_tx: "M12 5V1L7 6l5 5V7a6 6 0 11-6 6H4a8 8 0 108-8z",
  // OOK Editor: pencil waveform
  ook_editor_tx: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  // Frequency Hopper: zigzag arrows
  freq_hopper: "M4 4l4 4-4 4m4 0l4 4-4 4M16 4l4 4-4 4m0 4l4-4-4-4",
  // BLE Transmitter: bluetooth
  btle_tx: "M17 7l-5-5v7.59L7.41 5 6 6.41 10.59 11 6 15.59 7.41 17 12 12.41V20l5-5-3.59-4L17 7zm-4-1.17l1.88 1.88L13 9.59V5.83zm1.88 8.29L13 18.17v-3.76l1.88 1.88z",
  // NRF24 Transmitter: chip / IC
  nrf24_tx: "M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42A9.96 9.96 0 0012 2a10 10 0 00-10 10 10 10 0 0010 10 10 10 0 007.45-3.37l-1.42-1.42A8 8 0 1120 12c0 1.61-.48 3.11-1.29 4.37l1.42 1.42A9.96 9.96 0 0022 12c0-2.49-.92-4.77-2.42-6.53z",
  // RFM69 Transmitter: radio module
  rfm69_tx: "M7 2v2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3V2H7zm-3 4h16v12H4V6zm4 2v8h2V8H8zm4 2v6h2v-6h-2zm4 1v5h2V11h-2z",
  // Flipper Emulator: dolphin
  flipper_tx: "M13 2c-2.8 0-5 2-5.5 4.5C5.3 7.3 4 9 4 11c0 1.3.5 2.4 1.3 3.3L4 20h3l.5-2h9l.5 2h3l-1.3-5.7c.8-.9 1.3-2 1.3-3.3 0-2-1.3-3.7-3.5-4.5C16 4 14 2 13 2zm-2 8a1 1 0 110-2 1 1 0 010 2z",
  // Keyfob Emulator: key
  keyfob_tx: "M12.65 10A5.99 5.99 0 007 6a6 6 0 00-6 6 6 6 0 006 6 5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM7 14a2 2 0 110-4 2 2 0 010 4z",
  // LGE Transmitter: LoRa gateway / house antenna
  lge_tx: "M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 3.5L17 11v7h-2v-6H9v6H7v-7l5-4.5z",

  // ---- ANALYSIS ----
  // Frequency Scanner: magnifying glass
  scanner: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z",
  // Recon Scanner: detective / binoculars
  recon: "M12 4C7 4 2.73 7.11 1 11c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z",
  // Spectrum Panorama: panorama / rainbow
  looking_glass: "M2 6h1v12H2V6zm3 0h1v12H5V6zm3 2h1v8H8V8zm3-2h2v12h-2V6zm5 2h1v8h-1V8zm3-2h1v12h-1V6zm3 2h1v8h-1V8z",
  // OOK Analyzer: bar chart
  ook_analyzer: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
  // OOK Decoders: unlock
  ook_decoders: "M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 12a2 2 0 110-4 2 2 0 010 4z",
  // Sub-GHz Capture: download / save
  sub_ghz_capture: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  // Signal Meter: trending up
  signal_meter: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z",
  // Frequency Counter: numbers / hash
  freq_counter: "M5 7h2v10H5V7zm4 0h2v10H9V7zm4 0h2v10h-2V7zm4 0h2v10h-2V7zM4 4v2h16V4H4zm0 14v2h16v-2H4z",
  // BLE Scanner: bluetooth search
  btle_rx: "M14.88 7l-4.88-5v7.59L5.41 5 4 6.41 8.59 11 4 15.59 5.41 17l4.59-4.59V20l4.88-5L11.59 12l3.29-5zM12 5.83l1.88 1.88L12 9.59V5.83zm1.88 10.29L12 18.17v-3.76l1.88 1.71zM19 10h2a8 8 0 010 4h-2a6 6 0 000-4z",
  // BLE Communicator: chat bluetooth
  btle_comm: "M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm-7 12l-2-2-2 2-1.5-1.5L10 10 7.5 7.5 9 6l2 2 2-2 1.5 1.5L12 10l2.5 2.5L13 14z",
  // NRF24 Sniffer: antenna receiving
  nrf24_rx: "M12 2a1 1 0 00-1 1v8.26A4 4 0 1016 15a3.99 3.99 0 00-3-3.87V3a1 1 0 00-1-1zm0 11a2 2 0 100 4 2 2 0 000-4zM5 6l1.5 1.5A7.96 7.96 0 004 13h2a5.97 5.97 0 011.88-4.38L9.5 10A4.47 4.47 0 008 13h2c0-.83.34-1.58.88-2.12",
  // Encoder Suite: lock
  encoder_suite: "M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-6 9a2 2 0 110-4 2 2 0 010 4zM9 8V6a3 3 0 016 0v2H9z",
  // Multi-Protocol RX: layers / stack
  decoder_suite: "M12 2L2 7l10 5 10-5-10-5zm0 7.5L4.47 5.77 2 7l10 5 10-5-2.47-1.23L12 9.5zM2 17l10 5 10-5-2.47-1.23L12 19.5l-7.53-3.73L2 17zm0-5l10 5 10-5-2.47-1.23L12 14.5l-7.53-3.73L2 12z",
  // Capture Manager: folder
  capture_manager: "M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z",
  // RF Characterization: ruler / measure
  rf_characterize: "M3 5v14h18V5H3zm16 12H5V7h14v10zM7 9h2v2H7V9zm0 4h2v2H7v-2zm4-4h6v2h-6V9zm0 4h6v2h-6v-2z",
  // Protocol Analyzer: eye
  protocol_analyzer: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z",
  // IQ File Player: play button
  iq_player: "M8 5v14l11-7L8 5z",
  // SDR Benchmark: speedometer
  sdr_benchmark: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm1-13h-2v5l4.28 2.54.72-1.21-3-1.78V7z",

  // ---- TOOLS ----
  // Frequency Manager: list / clipboard
  freq_manager: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z",
  // File Manager: folder open
  // TX Playlist: playlist / queue
  playlist: "M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm17-5.07V4h-2v5.07A3.39 3.39 0 0017 9a3 3 0 103 3v-1.07zM17 13a1 1 0 110-2 1 1 0 010 2z",
  // Settings: gear
  settings: "M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.63-.94l-.36-2.54a.48.48 0 00-.47-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.63.94l-2.39-.96a.49.49 0 00-.59.22L3.71 9.87a.48.48 0 00.12.61l2.03 1.58a7.07 7.07 0 000 1.88l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.63.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.57 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1115.5 12 3.5 3.5 0 0112 15.5z",
  // RF Calculator: calculator
  calculator: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-8 14H7v-2h4v2zm0-4H7v-2h4v2zm0-4H7V7h4v2zm6 8h-4v-6h4v6zm0-8h-4V7h4v2z",
  // Notepad: pencil on paper
  notepad: "M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06zM17.66 3a1 1 0 00-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z",
  // Band Plan Reference: spectrum / chart bars
  band_plan: "M3 3v18h18v-2H5V3H3zm4 14V9h3v8H7zm5 0V5h3v12h-3zm5 0v-6h3v6h-3z",
  // Antenna Calculator: antenna / tower
  antenna_calc: "M12 5a1 1 0 100-2 1 1 0 000 2zm-3 1l3 3 3-3m-4 3v12H9v2h6v-2h-2V9z",
  // Remote Control: globe / network
  remote_control: "M12 2a10 10 0 100 20 10 10 0 000-20zm-1 17.93A8 8 0 014.07 13H7v-2H4.07A8 8 0 0111 4.07V7h2V4.07A8 8 0 0119.93 11H17v2h2.93A8 8 0 0113 19.93V17h-2v2.93z",
  // Morse Trainer: book / learning
  morse_trainer: "M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  recordings: "M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zm5 9a5 5 0 11-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z",
};

// Category → app definitions with descriptions and usage info
const APP_CATEGORIES = [
  {
    id: "receivers",
    label: "Receivers",
    apps: [
      { id: "nfm_audio", name: "NFM Audio", icon: ICON_PATHS.nfm_audio, color: "#3b82f6", description: "Narrowband FM receiver for two-way radio, walkie-talkies, and public safety communications.", howToUse: "Set frequency to the target channel (e.g. 462.5625 MHz for FRS). Adjust squelch to mute noise. Audio plays through speakers automatically." },
      { id: "wfm_rx", name: "Wideband FM", icon: ICON_PATHS.wfm_rx, color: "#6366f1", description: "Wideband FM receiver for commercial broadcast radio stations (88-108 MHz).", howToUse: "Tune to any FM broadcast frequency between 88-108 MHz. Stereo audio decodes automatically. Use RDS display for station info." },
      { id: "am_rx", name: "AM Receiver", icon: ICON_PATHS.am_rx, color: "#8b5cf6", description: "Amplitude modulation receiver for AM broadcast, aviation, and shortwave radio.", howToUse: "Set frequency to target AM station. Works for aviation (118-136 MHz), AM broadcast (530-1700 kHz), and shortwave bands." },
      { id: "usb_rx", name: "USB Receiver", icon: ICON_PATHS.usb_rx, color: "#a855f7", description: "Upper sideband receiver for amateur radio and HF communications.", howToUse: "Tune to the amateur HF band. USB is standard for frequencies above 10 MHz. Adjust BFO for clarity." },
      { id: "lsb_rx", name: "LSB Receiver", icon: ICON_PATHS.lsb_rx, color: "#a855f7", description: "Lower sideband receiver for amateur radio below 10 MHz.", howToUse: "Tune to amateur bands below 10 MHz (40m, 80m, 160m). LSB is the convention for these frequencies." },
      { id: "cw_rx", name: "CW Receiver", icon: ICON_PATHS.cw_rx, color: "#eab308", description: "Continuous wave (Morse code) receiver with narrow filter for CW signals.", howToUse: "Tune to CW portion of amateur bands. Narrow filter isolates single CW signals. Adjust tone pitch to preference." },
      { id: "rds_rx", name: "RDS Decoder", icon: ICON_PATHS.rds_rx, color: "#06b6d4", description: "Radio Data System decoder that extracts station name, song info, and traffic data from FM broadcasts.", howToUse: "Tune to any FM station broadcasting RDS. Station name (PS), radio text (RT), and program type display automatically." },
      { id: "adsb_rx", name: "ADS-B Receiver", icon: ICON_PATHS.adsb_rx, color: "#10b981", description: "Automatic Dependent Surveillance-Broadcast receiver tracking aircraft positions on 1090 MHz.", howToUse: "No tuning needed — automatically listens on 1090 MHz. Aircraft appear on the map with callsign, altitude, and speed." },
      { id: "adsb_rx_ext", name: "ADS-B Extended", icon: ICON_PATHS.adsb_rx_ext, color: "#10b981", description: "Enhanced ADS-B receiver with extended squitter decoding, aircraft database, and flight path history.", howToUse: "Same as ADS-B but with additional data fields, aircraft type lookup, and trail history on map." },
    ],
  },
  {
    id: "digital",
    label: "Digital",
    apps: [
      { id: "aprs_rx", name: "APRS Receiver", icon: ICON_PATHS.aprs_rx, color: "#f59e0b", description: "Automatic Packet Reporting System decoder for amateur radio position reports and messaging on 144.39 MHz.", howToUse: "Set to 144.39 MHz (NA) or 144.80 MHz (EU). Stations appear on map with callsign, position, and status messages." },
      { id: "ais_rx", name: "AIS Receiver", icon: ICON_PATHS.ais_rx, color: "#0ea5e9", description: "Automatic Identification System receiver tracking maritime vessels on 161.975/162.025 MHz.", howToUse: "Listens on marine AIS channels automatically. Ships appear with MMSI, name, position, course, and speed." },
      { id: "acars_rx", name: "ACARS Decoder", icon: ICON_PATHS.acars_rx, color: "#14b8a6", description: "Aircraft Communications Addressing and Reporting System decoder for airline datalink messages.", howToUse: "Tune to ACARS frequencies (129.125, 130.025, 130.450 MHz). Decoded messages show flight info, OOOI events, and free text." },
      { id: "pocsag_rx", name: "POCSAG Receiver", icon: ICON_PATHS.pocsag_rx, color: "#ec4899", description: "Pager protocol decoder for POCSAG messages — intercepts numeric and alphanumeric pages.", howToUse: "Tune to local pager frequency (common: 152.48, 157.90 MHz). Messages display with address (capcode) and content." },
      { id: "flex_rx", name: "FLEX Receiver", icon: ICON_PATHS.flex_rx, color: "#f43f5e", description: "Motorola FLEX paging protocol decoder for high-speed pager networks.", howToUse: "Tune to FLEX pager frequency (929 MHz band common). Decodes 1600/3200/6400 baud messages automatically." },
      { id: "afsk_rx", name: "AFSK Decoder", icon: ICON_PATHS.afsk_rx, color: "#84cc16", description: "Audio Frequency Shift Keying decoder for packet radio, APRS, and other AFSK-modulated data.", howToUse: "Set frequency and baud rate (1200 baud Bell 202 is common). Raw decoded bytes display in hex and ASCII." },
      { id: "dmr_rx", name: "DMR Receiver", icon: ICON_PATHS.dmr_rx, color: "#f97316", description: "Digital Mobile Radio decoder for unencrypted DMR trunked radio systems.", howToUse: "Tune to DMR repeater frequency. Decodes both timeslots. Only unencrypted traffic can be heard." },
      { id: "dpmr_rx", name: "dPMR Receiver", icon: ICON_PATHS.dpmr_rx, color: "#fb923c", description: "Digital Private Mobile Radio decoder for dPMR protocol communications.", howToUse: "Tune to dPMR channel frequency. Decodes FDMA digital voice and data in unencrypted mode." },
      { id: "p25_rx", name: "P25 Receiver", icon: ICON_PATHS.p25_rx, color: "#3b82f6", description: "Project 25 digital voice decoder for public safety and law enforcement radio systems.", howToUse: "Tune to P25 system frequency. Decodes Phase 1 (FDMA) unencrypted voice traffic." },
      { id: "nxdn_rx", name: "NXDN Receiver", icon: ICON_PATHS.nxdn_rx, color: "#6366f1", description: "NXDN digital voice decoder for Kenwood/Icom digital radio systems.", howToUse: "Tune to NXDN channel. Decodes 4800/9600 baud modes. Only unencrypted traffic is decoded." },
      { id: "tetra_rx", name: "TETRA Receiver", icon: ICON_PATHS.tetra_rx, color: "#8b5cf6", description: "Terrestrial Trunked Radio decoder for European public safety and commercial TETRA networks.", howToUse: "Tune to TETRA downlink frequency. Decodes unencrypted voice and signaling data." },
      { id: "pager_aggregator", name: "Pager Aggregator", icon: ICON_PATHS.pager_aggregator, color: "#d946ef", description: "Multi-protocol pager monitor that decodes POCSAG, FLEX, and ERMES simultaneously.", howToUse: "Configure multiple pager frequencies. All protocols decode in parallel with unified message display." },
    ],
  },
  {
    id: "sensors",
    label: "Sensors",
    apps: [
      { id: "ert_rx", name: "ERT Meter Reader", icon: ICON_PATHS.ert_rx, color: "#eab308", description: "Encoder Receiver Transmitter decoder for smart utility meters (electric, gas, water) on 900 MHz.", howToUse: "Listens on 915 MHz ISM band. Utility meter readings appear with meter ID, type, and consumption data." },
      { id: "weather_rx", name: "Weather Station", icon: ICON_PATHS.weather_rx, color: "#0ea5e9", description: "Wireless weather sensor decoder for common ISM-band temperature, humidity, and rain sensors.", howToUse: "Monitors 433.92 MHz (EU) or 915 MHz (US). Decodes Oregon Scientific, Acurite, and other common protocols." },
      { id: "sonde_rx", name: "Radiosonde RX", icon: ICON_PATHS.sonde_rx, color: "#a855f7", description: "Weather balloon radiosonde tracker decoding telemetry (GPS, temp, humidity, pressure).", howToUse: "Tune to sonde frequency (400-406 MHz). Auto-detects RS41, RS92, DFM types. Position shows on map." },
      { id: "sonde_rx_ext", name: "Radiosonde Extended", icon: ICON_PATHS.sonde_rx_ext, color: "#7c3aed", description: "Enhanced radiosonde decoder with prediction, burst altitude estimation, and landing zone calculation.", howToUse: "Same as Sonde RX but adds flight path prediction and estimated landing coordinates." },
      { id: "tpms_rx", name: "TPMS Decoder", icon: ICON_PATHS.tpms_rx, color: "#64748b", description: "Tire Pressure Monitoring System decoder reading pressure and temperature from vehicle tire sensors.", howToUse: "Monitors 315 MHz (US) or 433.92 MHz (EU). Displays sensor ID, pressure (PSI/kPa), and temperature." },
      { id: "two_tone_rx", name: "Two-Tone Paging", icon: ICON_PATHS.two_tone_rx, color: "#ef4444", description: "Sequential two-tone decoder for fire/EMS paging systems used to dispatch emergency services.", howToUse: "Tune to dispatch frequency. Detects tone-A and tone-B sequences with timing. Logs all pages with timestamps." },
      { id: "dsc_rx", name: "DSC Decoder", icon: ICON_PATHS.dsc_rx, color: "#0891b2", description: "Digital Selective Calling decoder for maritime distress and safety communications on VHF.", howToUse: "Monitors DSC channel 70 (156.525 MHz). Decodes distress alerts, position reports, and routine calls." },
      { id: "epirb_rx", name: "EPIRB Decoder", icon: ICON_PATHS.epirb_rx, color: "#dc2626", description: "Emergency Position Indicating Radio Beacon detector for maritime/aviation distress beacons on 406 MHz.", howToUse: "Monitors 406 MHz. Decodes beacon ID (hex), country code, and GPS position from emergency beacons." },
      { id: "ctcss_dcs", name: "CTCSS/DCS Scanner", icon: ICON_PATHS.ctcss_dcs, color: "#84cc16", description: "Detects sub-audible CTCSS tones and DCS codes used for repeater access and squelch control.", howToUse: "Tune to a repeater frequency. The detected CTCSS tone (67-254.1 Hz) or DCS code displays automatically." },
    ],
  },
  {
    id: "satellite",
    label: "Satellite",
    apps: [
      { id: "apt_rx", name: "NOAA APT", icon: ICON_PATHS.apt_rx, color: "#06b6d4", description: "Receives and decodes weather satellite images from NOAA 15/18/19 APT transmissions on 137 MHz.", howToUse: "Tune to NOAA satellite frequency (137.1, 137.62, 137.9125 MHz) during a pass. Image builds line-by-line." },
      { id: "hrpt_rx", name: "HRPT Receiver", icon: ICON_PATHS.hrpt_rx, color: "#0e7490", description: "High Resolution Picture Transmission decoder for detailed satellite imagery from NOAA and MetOp.", howToUse: "Requires dish antenna. Tune to 1.698-1.707 GHz during satellite pass. Full-color high-res images." },
      { id: "lrpt_rx", name: "Meteor LRPT", icon: ICON_PATHS.lrpt_rx, color: "#6366f1", description: "Low Rate Picture Transmission decoder for Russian Meteor-M satellite digital weather imagery.", howToUse: "Tune to 137.1 or 137.9 MHz during Meteor-M pass. Digital image with better quality than NOAA APT." },
      { id: "dab_rx", name: "DAB Radio", icon: ICON_PATHS.dab_rx, color: "#8b5cf6", description: "Digital Audio Broadcasting receiver for European digital radio ensembles (Band III, 174-240 MHz).", howToUse: "Tune to DAB ensemble frequency. Browse stations within the multiplex and select to listen." },
    ],
  },
  {
    id: "transmit",
    label: "Transmit",
    apps: [
      { id: "pocsag_tx", name: "POCSAG Transmitter", icon: ICON_PATHS.pocsag_tx, color: "#f43f5e", description: "Transmits POCSAG pager messages — send numeric or alphanumeric pages to specific capcodes.", howToUse: "Set frequency, baud rate (512/1200/2400), capcode (address), and message. Arm TX and transmit." },
      { id: "rtty_tx", name: "RTTY Transmitter", icon: ICON_PATHS.rtty_tx, color: "#f59e0b", description: "Radioteletype transmitter for sending RTTY text over RF using FSK modulation.", howToUse: "Set frequency, baud rate (45.45 typical), and shift (170 Hz). Type message and transmit." },
      { id: "sstv_tx", name: "SSTV Transmitter", icon: ICON_PATHS.sstv_tx, color: "#a855f7", description: "Slow Scan Television transmitter — sends images over radio using audio frequency modulation.", howToUse: "Load an image, select SSTV mode (Scottie, Martin, etc.), set frequency, and transmit." },
      { id: "afsk_tx", name: "AFSK Transmitter", icon: ICON_PATHS.afsk_tx, color: "#10b981", description: "Audio Frequency Shift Keying transmitter for sending packet radio and custom AFSK data.", howToUse: "Configure mark/space frequencies, baud rate, and data payload. Modulates audio tones onto RF carrier." },
      { id: "morse_tx", name: "Morse Transmitter", icon: ICON_PATHS.morse_tx, color: "#eab308", description: "CW (Morse code) transmitter — converts text to Morse and transmits as on-off keyed carrier.", howToUse: "Type message, set WPM speed and frequency. TX sends dots and dashes as RF carrier on/off." },
      { id: "soundboard_tx", name: "Audio Transmitter", icon: ICON_PATHS.soundboard_tx, color: "#6366f1", description: "FM audio transmitter — plays audio files or microphone input over a configurable FM carrier.", howToUse: "Select audio source (file or mic), set carrier frequency and FM deviation. Broadcasts audio as FM." },
      { id: "flex_tx", name: "FLEX Transmitter", icon: ICON_PATHS.flex_tx, color: "#ec4899", description: "Motorola FLEX protocol transmitter for sending high-speed pager messages.", howToUse: "Set frequency, capcode, and message content. Supports 1600/3200/6400 baud FLEX encoding." },
      { id: "sig_gen", name: "Signal Generator", icon: ICON_PATHS.sig_gen, color: "#14b8a6", description: "Continuous wave signal generator for testing — outputs a clean carrier at specified frequency and power.", howToUse: "Set output frequency and power level. Generates CW, sweep, or modulated test signals." },
      { id: "spectrum_painter", name: "Spectrum Painter", icon: ICON_PATHS.spectrum_painter, color: "#d946ef", description: "Draws images and text on the RF spectrum waterfall — visible to anyone watching that band.", howToUse: "Load image or type text. Set center frequency and bandwidth. The signal paints the image on spectrum analyzers." },
    ],
  },
  {
    id: "testing",
    label: "Testing",
    apps: [
      { id: "adsb_tx", name: "ADS-B Spoofer", icon: ICON_PATHS.adsb_tx, color: "#ef4444", description: "Generates fake ADS-B aircraft position reports for testing ADS-B receivers and displays.", howToUse: "Configure fake aircraft: callsign, ICAO address, position, altitude, speed. Transmits on 1090 MHz. FOR TESTING ONLY." },
      { id: "gps_sim", name: "GPS Simulator", icon: ICON_PATHS.gps_sim, color: "#dc2626", description: "Generates GPS L1 C/A signals simulating satellite constellation — spoofs GPS receivers to a fake location.", howToUse: "Set target lat/lon/altitude. Simulates visible satellites. GPS receivers in range will show the fake position. SHIELDED USE ONLY." },
      { id: "mdc1200_tx", name: "MDC1200 Encoder", icon: ICON_PATHS.mdc1200_tx, color: "#f97316", description: "Motorola MDC-1200 signaling encoder for generating PTT-ID, emergency, and call alert tones.", howToUse: "Set unit ID, operation type (PTT-ID, emergency, call), and frequency. Generates MDC-1200 burst." },
      { id: "replay_tx", name: "Signal Replay", icon: ICON_PATHS.replay_tx, color: "#8b5cf6", description: "Records and replays captured RF signals — useful for analyzing and retransmitting radio protocols.", howToUse: "Load a previously captured IQ file. Set replay frequency and sample rate. Retransmits the exact signal." },
      { id: "ook_editor_tx", name: "OOK Editor", icon: ICON_PATHS.ook_editor_tx, color: "#6366f1", description: "On-Off Keying signal editor — craft custom OOK/ASK signals bit by bit for device testing.", howToUse: "Define bit pattern, pulse width, and symbol rate. Preview waveform and transmit. For garage doors, remotes, etc." },
      { id: "freq_hopper", name: "Frequency Hopper", icon: ICON_PATHS.freq_hopper, color: "#0ea5e9", description: "Frequency hopping spread spectrum test tool — hops carrier across defined frequency pattern.", howToUse: "Define hop sequence, dwell time, and bandwidth. Signal jumps between frequencies on schedule." },
      { id: "btle_tx", name: "BLE Transmitter", icon: ICON_PATHS.btle_tx, color: "#3b82f6", description: "Bluetooth Low Energy advertisement transmitter — sends custom BLE advertisement packets.", howToUse: "Configure advertisement data, MAC address, and interval. Transmits BLE adverts on 2.4 GHz channels." },
      { id: "nrf24_tx", name: "NRF24 Transmitter", icon: ICON_PATHS.nrf24_tx, color: "#06b6d4", description: "nRF24L01 protocol transmitter for testing 2.4 GHz devices using Nordic Semiconductor protocol.", howToUse: "Set channel, address, payload, and data rate. Transmits nRF24-compatible packets." },
      { id: "rfm69_tx", name: "RFM69 Transmitter", icon: ICON_PATHS.rfm69_tx, color: "#14b8a6", description: "RFM69 module protocol transmitter for testing HopeRF-based ISM band devices.", howToUse: "Configure frequency, node ID, network ID, and payload. Sends RFM69-compatible packets." },
      { id: "flipper_tx", name: "Flipper Emulator", icon: ICON_PATHS.flipper_tx, color: "#f97316", description: "Transmits signals compatible with Flipper Zero .sub files — replay captured sub-GHz signals.", howToUse: "Load .sub file from Flipper Zero captures. Replays the signal at original frequency and modulation." },
      { id: "keyfob_tx", name: "Keyfob Emulator", icon: ICON_PATHS.keyfob_tx, color: "#64748b", description: "Car keyfob signal generator for testing vehicle remote keyless entry systems.", howToUse: "Select vehicle protocol, set frequency (315/433 MHz), configure rolling code parameters. FOR AUTHORIZED TESTING ONLY." },
      { id: "lge_tx", name: "LGE Transmitter", icon: ICON_PATHS.lge_tx, color: "#84cc16", description: "Long-range (LoRa-style) gateway emulator for testing IoT long-range communication links.", howToUse: "Set spreading factor, bandwidth, and coding rate. Transmits LoRa-compatible test frames." },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    apps: [
      { id: "scanner", name: "Frequency Scanner", icon: ICON_PATHS.scanner, color: "#3b82f6", description: "Scans a frequency range and stops on active signals — find what's transmitting in a band.", howToUse: "Set start/end frequency and step size. Scanner sweeps and pauses on signals above squelch threshold." },
      { id: "recon", name: "Recon Scanner", icon: ICON_PATHS.recon, color: "#6366f1", description: "Advanced reconnaissance scanner with signal logging, frequency database, and pattern detection.", howToUse: "Define scan ranges or load frequency list. Logs all activity with timestamps, signal strength, and duration." },
      { id: "looking_glass", name: "Spectrum Panorama", icon: ICON_PATHS.looking_glass, color: "#a855f7", description: "Wideband spectrum sweep — captures panoramic view across a large frequency range.", howToUse: "Set sweep range (up to full HackRF bandwidth). Builds panoramic spectrum display showing all signals." },
      { id: "ook_analyzer", name: "OOK Analyzer", icon: ICON_PATHS.ook_analyzer, color: "#f59e0b", description: "Analyzes On-Off Keying signals to determine bit patterns, timing, and protocol structure.", howToUse: "Tune to OOK signal frequency. Captures pulses and displays timing diagram with decoded bit pattern." },
      { id: "ook_decoders", name: "OOK Decoders", icon: ICON_PATHS.ook_decoders, color: "#10b981", description: "Protocol-specific OOK decoders for common remotes, sensors, and ISM devices.", howToUse: "Select protocol or use auto-detect. Decodes known OOK protocols (PT2262, EV1527, etc.) showing device codes." },
      { id: "sub_ghz_capture", name: "Sub-GHz Capture", icon: ICON_PATHS.sub_ghz_capture, color: "#0ea5e9", description: "Records raw IQ data from sub-GHz bands for later analysis or replay.", howToUse: "Set center frequency and sample rate. Records to file. Use IQ Player or Replay TX to play back." },
      { id: "signal_meter", name: "Signal Meter", icon: ICON_PATHS.signal_meter, color: "#eab308", description: "Real-time signal strength meter (S-meter) with peak hold, averaging, and history graph.", howToUse: "Tune to frequency of interest. Displays dBm power level with analog meter, peak, and time plot." },
      { id: "freq_counter", name: "Frequency Counter", icon: ICON_PATHS.freq_counter, color: "#14b8a6", description: "Precision frequency counter — measures the exact frequency of a received signal.", howToUse: "Works on strong signals. Measures and displays exact carrier frequency with Hz precision." },
      { id: "btle_rx", name: "BLE Scanner", icon: ICON_PATHS.btle_rx, color: "#3b82f6", description: "Bluetooth Low Energy passive scanner — captures BLE advertisement packets from nearby devices.", howToUse: "Scans all three BLE advertisement channels. Lists discovered devices with MAC, name, and RSSI." },
      { id: "btle_comm", name: "BLE Communicator", icon: ICON_PATHS.btle_comm, color: "#6366f1", description: "BLE GATT interaction tool — connect to BLE devices, read/write characteristics.", howToUse: "Select discovered device, enumerate services/characteristics. Read, write, or subscribe to notifications." },
      { id: "nrf24_rx", name: "NRF24 Sniffer", icon: ICON_PATHS.nrf24_rx, color: "#06b6d4", description: "Passive sniffer for nRF24L01 2.4 GHz protocol — captures packets from wireless mice, keyboards, drones.", howToUse: "Scans 2.4 GHz channels for nRF24 traffic. Displays captured packets with address, channel, and payload." },
      { id: "encoder_suite", name: "Encoder Suite", icon: ICON_PATHS.encoder_suite, color: "#f43f5e", description: "Multi-protocol encoder for generating test signals: DTMF, two-tone, five-tone, and more.", howToUse: "Select encoding type, configure parameters, and generate signal. Useful for radio system testing." },
      { id: "decoder_suite", name: "Multi-Protocol RX", icon: ICON_PATHS.decoder_suite, color: "#10b981", description: "Simultaneous multi-protocol decoder — monitors multiple digital protocols on one frequency.", howToUse: "Set frequency and enable desired decoders. All matching protocols decode in parallel." },
      { id: "capture_manager", name: "Capture Manager", icon: ICON_PATHS.capture_manager, color: "#8b5cf6", description: "Browse, organize, and manage saved IQ capture files with metadata and preview.", howToUse: "Lists all saved captures with date, frequency, and duration. Preview spectrum or load into player/replay." },
      { id: "rf_characterize", name: "RF Characterization", icon: ICON_PATHS.rf_characterize, color: "#f97316", description: "Characterize RF signals — measures bandwidth, modulation type, symbol rate, and signal parameters.", howToUse: "Tune to unknown signal. Analyzes and reports: bandwidth, modulation (FM/AM/PSK/FSK), baud rate, deviation." },
      { id: "protocol_analyzer", name: "Protocol Analyzer", icon: ICON_PATHS.protocol_analyzer, color: "#ec4899", description: "Deep protocol analysis tool — deframes, decodes, and annotates structured radio protocol packets.", howToUse: "Capture signal and select protocol family. Displays packet structure with field-by-field annotation." },
      { id: "iq_player", name: "IQ File Player", icon: ICON_PATHS.iq_player, color: "#84cc16", description: "Plays back recorded IQ files through the spectrum display and demodulators for offline analysis.", howToUse: "Load .cf32/.cs16 IQ file. Plays through waterfall and can be routed to any decoder for offline analysis." },
      { id: "sdr_benchmark", name: "SDR Benchmark", icon: ICON_PATHS.sdr_benchmark, color: "#64748b", description: "Performance benchmark for SDR pipeline — measures throughput, latency, and dropped samples.", howToUse: "Runs standardized tests at various sample rates. Reports maximum throughput and CPU usage." },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    apps: [
      { id: "freq_manager", name: "Frequency Manager", icon: ICON_PATHS.freq_manager, color: "#0ea5e9", description: "Save and organize favorite frequencies with labels, modulation settings, and notes.", howToUse: "Add frequencies with name, mode, and bandwidth. Quick-tune by selecting from your saved list." },
      { id: "playlist", name: "TX Playlist", icon: ICON_PATHS.playlist, color: "#10b981", description: "Queue multiple transmissions in sequence — automates multi-step TX operations.", howToUse: "Add TX operations to playlist with delays between them. Execute all in sequence automatically." },
      { id: "settings", name: "Settings", icon: ICON_PATHS.settings, color: "#64748b", description: "Configure HackRF hardware settings — antenna bias, clock, corrections, and UI preferences.", howToUse: "Adjust hardware settings: antenna bias-T power, frequency correction (PPM), UI theme, and default parameters." },
      { id: "calculator", name: "RF Calculator", icon: ICON_PATHS.calculator, color: "#8b5cf6", description: "RF engineering calculator — wavelength, free-space path loss, link budget, and unit conversions.", howToUse: "Select calculation type. Enter parameters. Results show wavelength, FSPL, EIRP, or converted units." },
      { id: "notepad", name: "Notepad", icon: ICON_PATHS.notepad, color: "#eab308", description: "Simple text notepad for jotting down frequencies, observations, and notes during sessions.", howToUse: "Type notes freely. Saves automatically. Useful for logging interesting findings during scanning." },
      { id: "band_plan", name: "Band Plan Reference", icon: ICON_PATHS.band_plan, color: "#3b82f6", description: "Visual band plan showing frequency allocations by service (amateur, commercial, military, ISM).", howToUse: "Browse by region (ITU). Tap any band for allocation details, permitted power, and common uses." },
      { id: "antenna_calc", name: "Antenna Calculator", icon: ICON_PATHS.antenna_calc, color: "#06b6d4", description: "Calculate antenna dimensions for dipole, quarter-wave, Yagi, and other common antenna types.", howToUse: "Select antenna type, enter target frequency. Calculator shows element lengths and spacing." },
      { id: "remote_control", name: "Remote Control", icon: ICON_PATHS.remote_control, color: "#a855f7", description: "Control GlassSDR remotely via network — start/stop apps, change frequency from another device.", howToUse: "Enable remote server with optional password. Connect from browser on same network to control." },
      { id: "morse_trainer", name: "Morse Trainer", icon: ICON_PATHS.morse_trainer, color: "#eab308", description: "Learn and practice Morse code with progressive lessons and speed drills.", howToUse: "Start with letters, progress to words. Adjustable WPM speed. Practice sending and receiving." },
      { id: "recordings", name: "Recordings", icon: ICON_PATHS.recordings, color: "#ef4444", description: "Browse all recordings captured across receivers, transmitters, and decoders, grouped by source app.", howToUse: "Open to see every recording on disk grouped by the app that produced it. Filter, inspect, or delete from one place." },
    ],
  },
];

interface AppGridProps {
  onSelectApp: (id: string) => void;
}

export interface AppEntry {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  howToUse: string;
}

/** Flat list of all apps across categories. */
export const ALL_APPS: AppEntry[] = APP_CATEGORIES.flatMap((c) => c.apps);

/** Lookup a single app by ID. */
export function getAppEntry(id: string): AppEntry | undefined {
  return ALL_APPS.find((a) => a.id === id);
}

export function AppGrid({ onSelectApp }: AppGridProps) {
  const [activeCategory, setActiveCategory] = useState("receivers");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pinnedApps = useStore((s) => s.pinnedApps);
  const togglePin = useStore((s) => s.togglePin);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      const timer = setTimeout(() => searchRef.current?.focus(), 400);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  const filteredApps = useMemo(() => {
    if (!search.trim()) {
      return APP_CATEGORIES.find((c) => c.id === activeCategory)?.apps || [];
    }
    const q = search.toLowerCase();
    return APP_CATEGORIES.flatMap((c) => c.apps).filter(
      (a) => a.name.toLowerCase().includes(q) || a.id.includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [activeCategory, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Tabs + search row */}
      <div className="toolbar-row">
        <button
          className={`search-toggle ${searchOpen ? "active" : ""}`}
          onClick={() => {
            if (searchOpen) { setSearch(""); setSearchOpen(false); }
            else { setSearchOpen(true); }
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <defs>
              <linearGradient id="ig-search" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#007AFF" />
                <stop offset="100%" stopColor="#5856D6" />
              </linearGradient>
            </defs>
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z" fill="url(#ig-search)" />
          </svg>
        </button>
        <div className="toolbar-content">
          <div className={`toolbar-search ${searchOpen ? "open" : ""}`}>
            <input
              ref={searchRef}
              className="toolbar-search-input"
              type="text"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setSearch(""); setSearchOpen(false); }
              }}
            />
          </div>
          <div className={`toolbar-tabs ${searchOpen ? "hidden" : ""}`}>
            <div className="category-tabs">
              {APP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-tab ${activeCategory === cat.id ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="section-divider" />

      {/* App list */}
      <div className="app-list-scroll">
        {search && filteredApps.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
            No apps match "{search}"
          </div>
        )}
        {filteredApps.map((app) => {
          const pinned = pinnedApps.includes(app.id);
          return (
          <div key={app.id} className="app-list-item" onClick={() => onSelectApp(app.id)}>
            <div
              className="app-list-icon"
              style={{ background: `linear-gradient(135deg, ${app.color}33, ${app.color}11)`, borderColor: `${app.color}44` }}
            >
              <SvgIcon path={app.icon} />
            </div>
            <div className="app-list-info">
              <div className="app-list-name">{app.name}</div>
              <div className="app-list-desc">{app.description}</div>
            </div>
            <button
              className={`app-list-pin ${pinned ? "pinned" : ""}`}
              onClick={(e) => { e.stopPropagation(); togglePin(app.id); }}
              title={pinned ? "Unpin from dashboard" : "Pin to dashboard"}
              aria-pressed={pinned}
            >
              <Icon name={pinned ? "lock" : "lockOpen"} size={13} />
            </button>
            <div
              className={`app-list-help ${tooltipId === app.id ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setTooltipId(tooltipId === app.id ? null : app.id);
              }}
            >
              ?
              {tooltipId === app.id && (
                <div className="app-list-tooltip">{app.howToUse}</div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
