import { useEffect, useState, useCallback } from "react";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { listUsbDevices, type UsbDevice } from "../../ipc/commands";
import "./Settings.css";

interface HardwareSettings {
  lnaGainDb: number;
  vgaGainDb: number;
  ppmCorrection: number;
  biasT: boolean;
  clockSource: "internal" | "external";
}

interface UiSettings {
  defaultUnit: "MHz" | "kHz" | "Hz";
  showTooltips: boolean;
  confirmDelete: boolean;
}

interface AllSettings { hw: HardwareSettings; ui: UiSettings; }

const LS_KEY = "mayhem_settings_v2";

const DEFAULTS: AllSettings = {
  hw: { lnaGainDb: 24, vgaGainDb: 30, ppmCorrection: 0, biasT: false, clockSource: "internal" },
  ui: { defaultUnit: "MHz", showTooltips: true, confirmDelete: true },
};

function loadSettings(): AllSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    // Migrate old format
    const legacy = localStorage.getItem("mayhem_settings");
    if (legacy) {
      const old = JSON.parse(legacy);
      return { ...DEFAULTS, hw: { ...DEFAULTS.hw, lnaGainDb: old.lnaGain ?? 24, vgaGainDb: old.vgaGain ?? 30 } };
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`stg-toggle${checked ? " stg-toggle--on" : ""}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="stg-toggle__thumb" />
    </button>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="stg-row">
      <div className="stg-row__label">
        <span className="stg-row__title">{label}</span>
        {sub && <span className="stg-row__sub">{sub}</span>}
      </div>
      <div className="stg-row__control">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SettingsApp() {
  const [cfg, setCfg]         = useState<AllSettings>(loadSettings);
  const [saved, setSaved]     = useState(false);
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [devError, setDevError] = useState(false);

  const refreshDevices = useCallback(() => {
    listUsbDevices()
      .then(setDevices)
      .catch(() => { setDevError(true); setDevices([]); });
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const setHw = <K extends keyof HardwareSettings>(key: K, val: HardwareSettings[K]) =>
    setCfg((c) => ({ ...c, hw: { ...c.hw, [key]: val } }));

  const setUi = <K extends keyof UiSettings>(key: K, val: UiSettings[K]) =>
    setCfg((c) => ({ ...c, ui: { ...c.ui, [key]: val } }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const hackrfDevices = devices.filter((d) => d.is_hackrf);

  const appStatus: AppStatus = saved ? "live" : "idle";
  const statusText = saved ? "Saved" : "Preferences";

  return (
    <AppScreen
      appId="settings"
      title="Settings"
      subtitle="GlassSDR Configuration"
      status={appStatus}
      statusText={statusText}
      actions={
        <button className="stg-save-btn" onClick={save}>
          {saved ? "✓ Saved" : "Save"}
        </button>
      }
    >
      <div className="stg-layout">
        {/* Hardware device section */}
        <GlassPanel title="Connected Devices" titleRight={
          <button className="stg-refresh" onClick={refreshDevices} title="Refresh">↻</button>
        }>
          {devError ? (
            <div className="stg-device-error">Unable to list USB devices</div>
          ) : devices.length === 0 ? (
            <div className="stg-device-empty">
              <span className="stg-device-empty__icon">⊙</span>
              <span>No USB devices detected</span>
            </div>
          ) : (
            <div className="stg-device-list">
              {devices.map((d) => (
                <div key={d.id} className={`stg-device${d.is_hackrf ? " stg-device--hackrf" : ""}`}>
                  <div className="stg-device__info">
                    <span className="stg-device__name">{d.name || "Unknown Device"}</span>
                    <span className="stg-device__ids">
                      {d.vendor_id.toString(16).padStart(4, "0").toUpperCase()}:
                      {d.product_id.toString(16).padStart(4, "0").toUpperCase()}
                    </span>
                  </div>
                  {d.is_hackrf && (
                    <span className="stg-device__badge">HackRF</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {hackrfDevices.length > 0 && (
            <div className="stg-device-status">
              <span className="stg-device-status__dot" />
              {hackrfDevices.length} HackRF device{hackrfDevices.length !== 1 ? "s" : ""} connected
            </div>
          )}
        </GlassPanel>

        {/* Hardware settings */}
        <GlassPanel title="Hardware">
          <div className="stg-section">
            <SettingRow label="LNA Gain" sub={`${cfg.hw.lnaGainDb} dB — amplifies before the mixer`}>
              <input
                className="stg-slider"
                type="range"
                min={0}
                max={40}
                step={8}
                value={cfg.hw.lnaGainDb}
                onChange={(e) => setHw("lnaGainDb", Number(e.target.value))}
              />
              <span className="stg-slider-val">{cfg.hw.lnaGainDb} dB</span>
            </SettingRow>
            <SettingRow label="VGA Gain" sub={`${cfg.hw.vgaGainDb} dB — baseband amplifier`}>
              <input
                className="stg-slider"
                type="range"
                min={0}
                max={62}
                step={2}
                value={cfg.hw.vgaGainDb}
                onChange={(e) => setHw("vgaGainDb", Number(e.target.value))}
              />
              <span className="stg-slider-val">{cfg.hw.vgaGainDb} dB</span>
            </SettingRow>
            <SettingRow label="PPM Correction" sub="Frequency offset error correction">
              <input
                className="stg-slider"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={cfg.hw.ppmCorrection}
                onChange={(e) => setHw("ppmCorrection", Number(e.target.value))}
              />
              <span className="stg-slider-val">{cfg.hw.ppmCorrection} ppm</span>
            </SettingRow>
            <SettingRow label="Bias-T" sub="Powers an antenna LNA via coax (+3.3 V)">
              <Toggle checked={cfg.hw.biasT} onChange={(v) => setHw("biasT", v)} />
            </SettingRow>
            <SettingRow label="Clock Source" sub="Reference oscillator">
              <select
                className="stg-select"
                value={cfg.hw.clockSource}
                onChange={(e) => setHw("clockSource", e.target.value as HardwareSettings["clockSource"])}
              >
                <option value="internal">Internal (default)</option>
                <option value="external">External 10 MHz</option>
              </select>
            </SettingRow>
          </div>
        </GlassPanel>

        {/* UI preferences */}
        <GlassPanel title="Interface">
          <div className="stg-section">
            <SettingRow label="Default Frequency Unit" sub="Shown in tuning inputs">
              <select
                className="stg-select"
                value={cfg.ui.defaultUnit}
                onChange={(e) => setUi("defaultUnit", e.target.value as UiSettings["defaultUnit"])}
              >
                <option value="MHz">MHz</option>
                <option value="kHz">kHz</option>
                <option value="Hz">Hz</option>
              </select>
            </SettingRow>
            <SettingRow label="Tooltips" sub="Show help tooltips on controls">
              <Toggle checked={cfg.ui.showTooltips} onChange={(v) => setUi("showTooltips", v)} />
            </SettingRow>
            <SettingRow label="Confirm Delete" sub="Ask before deleting recordings">
              <Toggle checked={cfg.ui.confirmDelete} onChange={(v) => setUi("confirmDelete", v)} />
            </SettingRow>
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
