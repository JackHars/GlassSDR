import { useState } from "react";
import { AppShell } from "../../components/AppShell";

interface Band { name: string; startMhz: number; endMhz: number; color: string; use: string; }

const BANDS: Band[] = [
  { name: "160m", startMhz: 1.8,   endMhz: 2.0,   color: "#22c55e", use: "HF — SSB, CW" },
  { name: "80m",  startMhz: 3.5,   endMhz: 4.0,   color: "#3b82f6", use: "HF — SSB, CW, digital" },
  { name: "40m",  startMhz: 7.0,   endMhz: 7.3,   color: "#f97316", use: "HF — DX, SSB, CW" },
  { name: "30m",  startMhz: 10.1,  endMhz: 10.15, color: "#84cc16", use: "HF — CW, digital (narrow)" },
  { name: "20m",  startMhz: 14.0,  endMhz: 14.35, color: "#ec4899", use: "HF — SSB, CW (prime DX)" },
  { name: "17m",  startMhz: 18.068,endMhz: 18.168,color: "#06b6d4", use: "HF — SSB, CW" },
  { name: "15m",  startMhz: 21.0,  endMhz: 21.45, color: "#eab308", use: "HF — SSB, CW" },
  { name: "12m",  startMhz: 24.89, endMhz: 24.99, color: "#a855f7", use: "HF — SSB, CW" },
  { name: "10m",  startMhz: 28.0,  endMhz: 29.7,  color: "#0ea5e9", use: "HF — SSB, CW, FM" },
  { name: "6m",   startMhz: 50.0,  endMhz: 54.0,  color: "#10b981", use: "VHF — SSB, CW, FM" },
  { name: "2m",   startMhz: 144.0, endMhz: 148.0, color: "#f59e0b", use: "VHF — FM, SSB, satellites" },
  { name: "70cm", startMhz: 420.0, endMhz: 450.0, color: "#6366f1", use: "UHF — FM, digital, ATV" },
  { name: "33cm", startMhz: 902.0, endMhz: 928.0, color: "#d946ef", use: "UHF — digital, weak signal" },
  { name: "23cm", startMhz: 1240,  endMhz: 1300,  color: "#8b5cf6", use: "UHF — ATV, weak signal" },
];

const MIN_MHZ = 1.8, MAX_MHZ = 1300;
const SVG_W = 880, SVG_H = 70;

function toX(mhz: number) { return ((Math.log10(mhz) - Math.log10(MIN_MHZ)) / (Math.log10(MAX_MHZ) - Math.log10(MIN_MHZ))) * SVG_W; }

export function BandPlanApp() {
  const [selected, setSelected] = useState<Band | null>(null);

  return (
    <AppShell title="Amateur Band Plan" status={<span>Click a band on the chart for details</span>}>
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", overflow: "auto" }}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block", width: "100%", height: "auto", cursor: "pointer" }}>
            {BANDS.map((b) => {
              const x1 = toX(b.startMhz), x2 = toX(b.endMhz);
              const w = Math.max(x2 - x1, 6);
              const isSel = selected?.name === b.name;
              return (
                <g key={b.name} onClick={() => setSelected(b)}>
                  <rect x={x1} y={isSel ? 6 : 12} width={w} height={isSel ? 56 : 44} fill={b.color} opacity={isSel ? 1 : 0.85} rx={4} />
                  {w > 22 && <text x={x1 + w / 2} y={36} textAnchor="middle" fontSize={11} fontWeight="600" fill="#fff">{b.name}</text>}
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            <span>{MIN_MHZ} MHz</span>
            <span>10 MHz</span>
            <span>100 MHz</span>
            <span>{MAX_MHZ} MHz</span>
          </div>
        </div>
        {selected && (
          <div style={{ padding: 16, background: "rgba(255,255,255,0.55)", border: `2px solid ${selected.color}`, borderRadius: 12, backdropFilter: "blur(16px)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: selected.color }}>{selected.name}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 16 }}>{selected.startMhz} – {selected.endMhz} MHz</div>
            <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 14 }}>{selected.use}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
