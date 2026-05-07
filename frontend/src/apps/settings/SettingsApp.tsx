import { useState } from "react";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface Settings {
  theme: "dark" | "light";
  lnaGain: number;
  vgaGain: number;
}

const LS_KEY = "mayhem_settings";

function loadSettings(): Settings {
  try { return { theme: "dark", lnaGain: 24, vgaGain: 30, ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") }; }
  catch { return { theme: "dark", lnaGain: 24, vgaGain: 30 }; }
}

export function SettingsApp() {
  const [cfg, setCfg] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    setCfg((c) => ({ ...c, [key]: val }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppShell
      title="Settings"
      status={saved ? <><span style={{color: "#34C759"}}>●</span> Saved</> : <span>Configure HackRF defaults and UI preferences</span>}
      controls={
        <ControlRow
          actions={<button className="glass-btn primary" onClick={save}>Save</button>}
        >
          <ControlField label="Theme" size="md">
            <select value={cfg.theme} onChange={(e) => update("theme", e.target.value as Settings["theme"])}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </ControlField>
          <ControlField label={`Default LNA ${cfg.lnaGain} dB`} size="md">
            <input type="range" min={0} max={40} step={8} value={cfg.lnaGain} onChange={(e) => update("lnaGain", Number(e.target.value))} />
          </ControlField>
          <ControlField label={`Default VGA ${cfg.vgaGain} dB`} size="md">
            <input type="range" min={0} max={62} step={2} value={cfg.vgaGain} onChange={(e) => update("vgaGain", Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Current Configuration</h3>
          <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
            {JSON.stringify(cfg, null, 2)}
          </pre>
        </div>
      </div>
    </AppShell>
  );
}
