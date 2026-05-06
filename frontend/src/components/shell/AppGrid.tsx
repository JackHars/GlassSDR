import { useState, useMemo } from "react";

// Category → app definitions with emoji icons
const APP_CATEGORIES = [
  {
    id: "receivers",
    label: "Receivers",
    apps: [
      { id: "nfm_audio", name: "NFM", icon: "📻", color: "#3b82f6" },
      { id: "wfm_rx", name: "WFM", icon: "📡", color: "#6366f1" },
      { id: "am_rx", name: "AM", icon: "🔊", color: "#8b5cf6" },
      { id: "usb_rx", name: "USB", icon: "🎛️", color: "#a855f7" },
      { id: "lsb_rx", name: "LSB", icon: "🎚️", color: "#a855f7" },
      { id: "cw_rx", name: "CW", icon: "⚡", color: "#eab308" },
      { id: "rds_rx", name: "RDS", icon: "📺", color: "#06b6d4" },
      { id: "adsb_rx", name: "ADS-B", icon: "✈️", color: "#10b981" },
      { id: "adsb_rx_ext", name: "ADS-B+", icon: "🛫", color: "#10b981" },
    ],
  },
  {
    id: "digital",
    label: "Digital",
    apps: [
      { id: "aprs_rx", name: "APRS", icon: "📍", color: "#f59e0b" },
      { id: "ais_rx", name: "AIS", icon: "🚢", color: "#0ea5e9" },
      { id: "acars_rx", name: "ACARS", icon: "🛩️", color: "#14b8a6" },
      { id: "pocsag_rx", name: "POCSAG", icon: "📟", color: "#ec4899" },
      { id: "flex_rx", name: "FLEX", icon: "📟", color: "#f43f5e" },
      { id: "afsk_rx", name: "AFSK", icon: "〰️", color: "#84cc16" },
      { id: "dmr_rx", name: "DMR", icon: "🗣️", color: "#f97316" },
      { id: "dpmr_rx", name: "dPMR", icon: "🗣️", color: "#fb923c" },
      { id: "p25_rx", name: "P25", icon: "🚔", color: "#3b82f6" },
      { id: "nxdn_rx", name: "NXDN", icon: "🗣️", color: "#6366f1" },
      { id: "tetra_rx", name: "TETRA", icon: "🗣️", color: "#8b5cf6" },
      { id: "pager_aggregator", name: "Pagers", icon: "📟", color: "#d946ef" },
    ],
  },
  {
    id: "sensors",
    label: "Sensors",
    apps: [
      { id: "ert_rx", name: "ERT Meter", icon: "🔌", color: "#eab308" },
      { id: "weather_rx", name: "Weather", icon: "🌤️", color: "#0ea5e9" },
      { id: "sonde_rx", name: "Sonde", icon: "🎈", color: "#a855f7" },
      { id: "sonde_rx_ext", name: "Sonde+", icon: "🎈", color: "#7c3aed" },
      { id: "tpms_rx", name: "TPMS", icon: "🚗", color: "#64748b" },
      { id: "two_tone_rx", name: "Two-Tone", icon: "🚒", color: "#ef4444" },
      { id: "dsc_rx", name: "DSC", icon: "⚓", color: "#0891b2" },
      { id: "epirb_rx", name: "EPIRB", icon: "🆘", color: "#dc2626" },
      { id: "ctcss_dcs", name: "CTCSS", icon: "🔈", color: "#84cc16" },
    ],
  },
  {
    id: "satellite",
    label: "Satellite",
    apps: [
      { id: "apt_rx", name: "NOAA APT", icon: "🛰️", color: "#06b6d4" },
      { id: "hrpt_rx", name: "HRPT", icon: "🌍", color: "#0e7490" },
      { id: "lrpt_rx", name: "Meteor", icon: "☄️", color: "#6366f1" },
      { id: "dab_rx", name: "DAB", icon: "📻", color: "#8b5cf6" },
    ],
  },
  {
    id: "transmit",
    label: "Transmit",
    apps: [
      { id: "pocsag_tx", name: "POCSAG TX", icon: "📤", color: "#f43f5e" },
      { id: "rtty_tx", name: "RTTY TX", icon: "⌨️", color: "#f59e0b" },
      { id: "sstv_tx", name: "SSTV TX", icon: "🖼️", color: "#a855f7" },
      { id: "afsk_tx", name: "AFSK TX", icon: "📡", color: "#10b981" },
      { id: "morse_tx", name: "Morse TX", icon: "🔑", color: "#eab308" },
      { id: "soundboard_tx", name: "Audio TX", icon: "🔊", color: "#6366f1" },
      { id: "flex_tx", name: "FLEX TX", icon: "📟", color: "#ec4899" },
      { id: "sig_gen", name: "Sig Gen", icon: "📶", color: "#14b8a6" },
      { id: "spectrum_painter", name: "Painter", icon: "🎨", color: "#d946ef" },
    ],
  },
  {
    id: "testing",
    label: "Testing",
    apps: [
      { id: "adsb_tx", name: "ADS-B TX", icon: "✈️", color: "#ef4444" },
      { id: "gps_sim", name: "GPS Sim", icon: "🗺️", color: "#dc2626" },
      { id: "mdc1200_tx", name: "MDC1200", icon: "📢", color: "#f97316" },
      { id: "replay_tx", name: "Replay", icon: "🔁", color: "#8b5cf6" },
      { id: "ook_editor_tx", name: "OOK Edit", icon: "✏️", color: "#6366f1" },
      { id: "freq_hopper", name: "Hopper", icon: "🦘", color: "#0ea5e9" },
      { id: "btle_tx", name: "BLE TX", icon: "📶", color: "#3b82f6" },
      { id: "nrf24_tx", name: "NRF TX", icon: "📶", color: "#06b6d4" },
      { id: "rfm69_tx", name: "RFM69", icon: "📶", color: "#14b8a6" },
      { id: "flipper_tx", name: "Flipper", icon: "🐬", color: "#f97316" },
      { id: "keyfob_tx", name: "Keyfob", icon: "🔑", color: "#64748b" },
      { id: "lge_tx", name: "LGE", icon: "🏠", color: "#84cc16" },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    apps: [
      { id: "scanner", name: "Scanner", icon: "🔍", color: "#3b82f6" },
      { id: "recon", name: "Recon", icon: "🕵️", color: "#6366f1" },
      { id: "looking_glass", name: "Panorama", icon: "🌈", color: "#a855f7" },
      { id: "ook_analyzer", name: "OOK", icon: "📊", color: "#f59e0b" },
      { id: "ook_decoders", name: "Decoders", icon: "🔓", color: "#10b981" },
      { id: "sub_ghz_capture", name: "Capture", icon: "💾", color: "#0ea5e9" },
      { id: "signal_meter", name: "S-Meter", icon: "📈", color: "#eab308" },
      { id: "freq_counter", name: "Counter", icon: "🔢", color: "#14b8a6" },
      { id: "btle_rx", name: "BLE RX", icon: "📶", color: "#3b82f6" },
      { id: "btle_comm", name: "BLE Comm", icon: "💬", color: "#6366f1" },
      { id: "nrf24_rx", name: "NRF Sniff", icon: "👃", color: "#06b6d4" },
      { id: "encoder_suite", name: "Encoders", icon: "🔐", color: "#f43f5e" },
      { id: "decoder_suite", name: "Multi-RX", icon: "🔓", color: "#10b981" },
      { id: "capture_manager", name: "Manager", icon: "📁", color: "#8b5cf6" },
      { id: "rf_characterize", name: "RF Char", icon: "📐", color: "#f97316" },
      { id: "protocol_analyzer", name: "Protocol", icon: "👁️", color: "#ec4899" },
      { id: "iq_player", name: "IQ Play", icon: "▶️", color: "#84cc16" },
      { id: "sdr_benchmark", name: "Bench", icon: "🏎️", color: "#64748b" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    apps: [
      { id: "freq_manager", name: "Frequencies", icon: "📋", color: "#0ea5e9" },
      { id: "file_manager", name: "Files", icon: "📂", color: "#f59e0b" },
      { id: "playlist", name: "Playlist", icon: "▶️", color: "#10b981" },
      { id: "settings", name: "Settings", icon: "⚙️", color: "#64748b" },
      { id: "calculator", name: "Calculator", icon: "🧮", color: "#8b5cf6" },
      { id: "notepad", name: "Notepad", icon: "📝", color: "#eab308" },
      { id: "band_plan", name: "Band Plan", icon: "📊", color: "#3b82f6" },
      { id: "antenna_calc", name: "Antenna", icon: "📡", color: "#06b6d4" },
      { id: "remote_control", name: "Remote", icon: "🌐", color: "#a855f7" },
      { id: "snake", name: "Snake", icon: "🐍", color: "#10b981" },
      { id: "doom", name: "Doom", icon: "👾", color: "#ef4444" },
      { id: "morse_trainer", name: "Morse", icon: "📖", color: "#eab308" },
    ],
  },
];

interface AppGridProps {
  onSelectApp: (id: string) => void;
}

export function AppGrid({ onSelectApp }: AppGridProps) {
  const [activeCategory, setActiveCategory] = useState("receivers");
  const [search, setSearch] = useState("");

  const filteredApps = useMemo(() => {
    if (!search.trim()) {
      return APP_CATEGORIES.find((c) => c.id === activeCategory)?.apps || [];
    }
    const q = search.toLowerCase();
    return APP_CATEGORIES.flatMap((c) => c.apps).filter(
      (a) => a.name.toLowerCase().includes(q) || a.id.includes(q)
    );
  }, [activeCategory, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Search */}
      <div style={{ position: "relative", padding: "0 4px" }}>
        <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>
          🔍
        </span>
        <input
          className="search-bar"
          type="text"
          placeholder="Search apps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      {!search && (
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
      )}

      {/* App grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
        {search && filteredApps.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
            No apps match "{search}"
          </div>
        )}
        <div className="app-grid">
          {filteredApps.map((app) => (
            <button
              key={app.id}
              className="app-icon-card"
              onClick={() => onSelectApp(app.id)}
            >
              <div
                className="icon-circle"
                style={{ background: `linear-gradient(135deg, ${app.color}33, ${app.color}11)`, borderColor: `${app.color}44` }}
              >
                <span>{app.icon}</span>
              </div>
              <span className="icon-label">{app.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
