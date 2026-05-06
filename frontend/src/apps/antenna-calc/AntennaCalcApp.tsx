import { useState } from "react";

const m2ft = (m: number) => (m * 3.28084).toFixed(3);

interface Result { label: string; meters: number; formula: string; }

function calcAntennas(freqMhz: number): Result[] {
  if (!isFinite(freqMhz) || freqMhz <= 0) return [];
  return [
    { label: "Half-wave dipole (each leg)", meters: 143 / freqMhz / 2, formula: "71.5 / f" },
    { label: "Half-wave dipole (total)",    meters: 143 / freqMhz,     formula: "143 / f" },
    { label: "Quarter-wave vertical",       meters: 71.5 / freqMhz,    formula: "71.5 / f" },
    { label: "5/8-wave vertical",           meters: (5/8) * (300/freqMhz), formula: "187.5 / f" },
    { label: "Full-wave loop",              meters: 306 / freqMhz,     formula: "306 / f" },
  ];
}

const inp = { background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "4px 8px" } as const;
const row = { display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid #222" } as const;

export function AntennaCalcApp() {
  const [freqStr, setFreqStr] = useState("144.39");
  const freqMhz = parseFloat(freqStr);
  const results = calcAntennas(freqMhz);

  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Antenna Calculator</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ color: "#aaa", fontSize: 13 }}>Frequency (MHz)</label>
        <input value={freqStr} onChange={e => setFreqStr(e.target.value)} style={{ ...inp, width: 120, fontSize: 15 }} />
      </div>
      {results.length > 0 ? (
        <div style={{ background: "#1a1a2a", borderRadius: 6, border: "1px solid #333", overflow: "hidden" }}>
          <div style={{ ...row, background: "#1c1c2c", fontWeight: "bold", color: "#888", fontSize: 12 }}>
            <span>Antenna Type</span><span style={{ minWidth: 100, textAlign: "right" }}>Meters</span><span style={{ minWidth: 100, textAlign: "right" }}>Feet</span>
          </div>
          {results.map(r => (
            <div key={r.label} style={row}>
              <span style={{ color: "#ccc", fontSize: 13 }}>{r.label}</span>
              <span style={{ fontFamily: "monospace", color: "#8af", minWidth: 100, textAlign: "right" }}>{r.meters.toFixed(3)} m</span>
              <span style={{ fontFamily: "monospace", color: "#fa8", minWidth: 100, textAlign: "right" }}>{m2ft(r.meters)} ft</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#666" }}>Enter a valid frequency above</div>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: "#444" }}>Formulas use standard 95% velocity factor approximation.</div>
    </div>
  );
}
