import { useState } from "react";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

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

export function AntennaCalcApp() {
  const [freqStr, setFreqStr] = useState("144.39");
  const freqMhz = parseFloat(freqStr);
  const results = calcAntennas(freqMhz);

  return (
    <AppShell
      title="Antenna Calculator"
      controls={
        <ControlRow>
          <ControlField label="Frequency (MHz)" size="md">
            <input value={freqStr} onChange={(e) => setFreqStr(e.target.value)} style={{ fontSize: 15 }} />
          </ControlField>
        </ControlRow>
      }
      fillMain={false}
    >
      <div style={{ maxWidth: 600, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {results.length > 0 ? (
          <div style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", padding: "10px 16px", background: "rgba(0,0,0,0.04)", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>
              <span>Antenna Type</span>
              <span style={{ textAlign: "right" }}>Meters</span>
              <span style={{ textAlign: "right" }}>Feet</span>
            </div>
            {results.map((r) => (
              <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ color: "var(--text-primary)", fontSize: 14 }}>{r.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", textAlign: "right" }}>{r.meters.toFixed(3)}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "#FF9500", textAlign: "right" }}>{m2ft(r.meters)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-tertiary)" }}>Enter a valid frequency above.</div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          Formulas assume the standard 95% velocity factor approximation.
        </div>
      </div>
    </AppShell>
  );
}
