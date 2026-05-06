import { useState } from "react";

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

const inp = { background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 6px", borderRadius: 3 };

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
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, maxWidth: 400 }}>
        <label style={{ alignSelf: "center" }}>Theme</label>
        <select value={cfg.theme} onChange={(e) => update("theme", e.target.value as Settings["theme"])} style={inp}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>

        <label style={{ alignSelf: "center" }}>Default LNA Gain</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="range" min={0} max={40} step={8} value={cfg.lnaGain} onChange={(e) => update("lnaGain", Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ width: 50 }}>{cfg.lnaGain} dB</span>
        </div>

        <label style={{ alignSelf: "center" }}>Default VGA Gain</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="range" min={0} max={62} step={2} value={cfg.vgaGain} onChange={(e) => update("vgaGain", Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ width: 50 }}>{cfg.vgaGain} dB</span>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "6px 18px", cursor: "pointer" }}>Save</button>
        {saved && <span style={{ color: "#4c4", fontSize: 13 }}>Saved.</span>}
      </div>

      <div style={{ marginTop: 24, padding: 12, background: "#1a1a2a", borderRadius: 6, fontSize: 13, color: "#888" }}>
        <strong style={{ color: "#aaa" }}>Current config (JSON)</strong>
        <pre style={{ margin: "6px 0 0", color: "#ccc" }}>{JSON.stringify(cfg, null, 2)}</pre>
      </div>
    </div>
  );
}
