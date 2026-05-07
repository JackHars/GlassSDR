import { useState } from "react";
import { AppShell } from "../../components/AppShell";

const C = 299_792_458;

function fspl(distKm: number, freqMhz: number): number {
  return 20 * Math.log10(distKm * 1000) + 20 * Math.log10(freqMhz * 1e6) - 147.55;
}

function StdCalc() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const calc = () => {
    try {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict"; return (${expr})`)();
      setResult(String(r));
    } catch { setResult("Error"); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input value={expr} onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && calc()}
        placeholder="e.g. (144.39e6 / 2) + 1e3" style={{ fontSize: 16 }} />
      <button className="glass-btn primary" onClick={calc}>Calculate</button>
      {result !== null && (
        <div style={{ padding: 16, background: "rgba(0,0,0,0.04)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--accent)" }}>
          = {result}
        </div>
      )}
    </div>
  );
}

function RfCalc() {
  const [freqMhz, setFreqMhz] = useState("144.39");
  const [distKm, setDistKm] = useState("10");
  const [dbm, setDbm] = useState("20");

  const freq = parseFloat(freqMhz) * 1e6;
  const wl = freq > 0 ? (C / freq * 100).toFixed(2) : "—";
  const mw = parseFloat(dbm) > -900 ? Math.pow(10, parseFloat(dbm) / 10).toFixed(3) : "—";
  const path = (!isNaN(parseFloat(distKm)) && !isNaN(parseFloat(freqMhz))) ? fspl(parseFloat(distKm), parseFloat(freqMhz)).toFixed(1) : "—";

  const cellLabel: React.CSSProperties = { fontSize: 12, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" };
  const cellValue: React.CSSProperties = { padding: "10px 14px", background: "rgba(0,0,0,0.04)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--accent)" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Frequency (MHz)</span>
        <input value={freqMhz} onChange={(e) => setFreqMhz(e.target.value)} />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Wavelength</span>
        <div style={cellValue}>{wl} cm</div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Power (dBm)</span>
        <input value={dbm} onChange={(e) => setDbm(e.target.value)} />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Power (mW)</span>
        <div style={cellValue}>{mw}</div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Distance (km)</span>
        <input value={distKm} onChange={(e) => setDistKm(e.target.value)} />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={cellLabel}>Free-space path loss</span>
        <div style={cellValue}>{path} dB</div>
      </div>
    </div>
  );
}

export function CalculatorApp() {
  const [tab, setTab] = useState<"std" | "rf">("std");
  const tabBtn = (id: "std" | "rf", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={tab === id ? "glass-btn primary" : "glass-btn"}
      style={{ minWidth: 110 }}
    >
      {label}
    </button>
  );

  return (
    <AppShell title="RF Calculator" fillMain={false}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("std", "Standard")}
          {tabBtn("rf", "RF")}
        </div>
        <div style={{ padding: 20, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)" }}>
          {tab === "std" ? <StdCalc /> : <RfCalc />}
        </div>
      </div>
    </AppShell>
  );
}
