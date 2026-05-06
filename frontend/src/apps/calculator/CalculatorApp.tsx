import { useState } from "react";

const C = 299_792_458;

function fspl(distKm: number, freqMhz: number): number {
  return 20 * Math.log10(distKm * 1000) + 20 * Math.log10(freqMhz * 1e6) - 147.55;
}

const inp = { background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 6px", borderRadius: 3, width: "100%" };

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calc()} placeholder="e.g. (144.39e6 / 2) + 1e3" style={inp} />
      <button onClick={calc} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "5px 12px", cursor: "pointer" }}>Calculate</button>
      {result !== null && <div style={{ padding: 8, background: "#1a1a2a", borderRadius: 4, fontFamily: "monospace", fontSize: 15 }}>= {result}</div>}
    </div>
  );
}

function RfCalc() {
  const [freqMhz, setFreqMhz] = useState("144.39");
  const [distKm, setDistKm] = useState("10");
  const [dbm, setDbm] = useState("20");

  const freq = parseFloat(freqMhz) * 1e6;
  const wl = freq > 0 ? (C / freq * 100).toFixed(2) : "—";
  const mw = parseFloat(dbm) > -900 ? (Math.pow(10, parseFloat(dbm) / 10)).toFixed(3) : "—";
  const path = (!isNaN(parseFloat(distKm)) && !isNaN(parseFloat(freqMhz))) ? fspl(parseFloat(distKm), parseFloat(freqMhz)).toFixed(1) : "—";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, maxWidth: 420 }}>
      <label style={{ alignSelf: "center", color: "#aaa", fontSize: 13 }}>Frequency (MHz)</label>
      <input value={freqMhz} onChange={(e) => setFreqMhz(e.target.value)} style={inp} />
      <label style={{ color: "#8af", fontSize: 13 }}>→ Wavelength (cm)</label>
      <div style={{ padding: "4px 6px", background: "#1a1a2a", borderRadius: 3, fontFamily: "monospace" }}>{wl}</div>

      <div style={{ gridColumn: "1/-1", borderBottom: "1px solid #333", margin: "4px 0" }} />

      <label style={{ alignSelf: "center", color: "#aaa", fontSize: 13 }}>Power (dBm)</label>
      <input value={dbm} onChange={(e) => setDbm(e.target.value)} style={inp} />
      <label style={{ color: "#8af", fontSize: 13 }}>→ Power (mW)</label>
      <div style={{ padding: "4px 6px", background: "#1a1a2a", borderRadius: 3, fontFamily: "monospace" }}>{mw}</div>

      <div style={{ gridColumn: "1/-1", borderBottom: "1px solid #333", margin: "4px 0" }} />

      <label style={{ alignSelf: "center", color: "#aaa", fontSize: 13 }}>Distance (km)</label>
      <input value={distKm} onChange={(e) => setDistKm(e.target.value)} style={inp} />
      <label style={{ color: "#8af", fontSize: 13 }}>→ FSPL (dB)</label>
      <div style={{ padding: "4px 6px", background: "#1a1a2a", borderRadius: 3, fontFamily: "monospace" }}>{path}</div>
    </div>
  );
}

export function CalculatorApp() {
  const [tab, setTab] = useState<"std" | "rf">("std");
  const tabBtn = (id: "std" | "rf", label: string) => (
    <button onClick={() => setTab(id)} style={{ padding: "5px 16px", background: tab === id ? "#226" : "#1a1a2a", color: "#eee", border: "1px solid #333", borderRadius: "3px 3px 0 0", cursor: "pointer" }}>{label}</button>
  );
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Calculator</h2>
      <div style={{ marginBottom: 0 }}>{tabBtn("std", "Standard")} {tabBtn("rf", "RF")}</div>
      <div style={{ border: "1px solid #333", borderRadius: "0 3px 3px 3px", padding: 16, background: "#111" }}>
        {tab === "std" ? <StdCalc /> : <RfCalc />}
      </div>
    </div>
  );
}
