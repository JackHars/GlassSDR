import { useState } from "react";

interface Band { name: string; startMhz: number; endMhz: number; color: string; use: string; }

const BANDS: Band[] = [
  { name: "160m", startMhz: 1.8,   endMhz: 2.0,   color: "#4a6", use: "HF — SSB, CW" },
  { name: "80m",  startMhz: 3.5,   endMhz: 4.0,   color: "#46a", use: "HF — SSB, CW, digital" },
  { name: "40m",  startMhz: 7.0,   endMhz: 7.3,   color: "#a64", use: "HF — DX, SSB, CW" },
  { name: "30m",  startMhz: 10.1,  endMhz: 10.15, color: "#6a4", use: "HF — CW, digital (narrow)" },
  { name: "20m",  startMhz: 14.0,  endMhz: 14.35, color: "#a46", use: "HF — SSB, CW (prime DX)" },
  { name: "17m",  startMhz: 18.068,endMhz: 18.168,color: "#4aa", use: "HF — SSB, CW" },
  { name: "15m",  startMhz: 21.0,  endMhz: 21.45, color: "#aa4", use: "HF — SSB, CW" },
  { name: "12m",  startMhz: 24.89, endMhz: 24.99, color: "#a4a", use: "HF — SSB, CW" },
  { name: "10m",  startMhz: 28.0,  endMhz: 29.7,  color: "#48a", use: "HF — SSB, CW, FM" },
  { name: "6m",   startMhz: 50.0,  endMhz: 54.0,  color: "#8a4", use: "VHF — SSB, CW, FM" },
  { name: "2m",   startMhz: 144.0, endMhz: 148.0, color: "#a84", use: "VHF — FM, SSB, satellites" },
  { name: "70cm", startMhz: 420.0, endMhz: 450.0, color: "#68a", use: "UHF — FM, digital, ATV" },
  { name: "33cm", startMhz: 902.0, endMhz: 928.0, color: "#a68", use: "UHF — digital, weak signal" },
  { name: "23cm", startMhz: 1240,  endMhz: 1300,  color: "#86a", use: "UHF — ATV, weak signal" },
];

const MIN_MHZ = 1.8, MAX_MHZ = 1300;
const SVG_W = 700, SVG_H = 60;

function toX(mhz: number) { return ((Math.log10(mhz) - Math.log10(MIN_MHZ)) / (Math.log10(MAX_MHZ) - Math.log10(MIN_MHZ))) * SVG_W; }

export function BandPlanApp() {
  const [selected, setSelected] = useState<Band | null>(null);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Amateur Band Plan</h2>
      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>Log-scale · click a band for details</div>
      <svg width={SVG_W} height={SVG_H} style={{ display: "block", background: "#1a1a2a", border: "1px solid #333", borderRadius: 4, cursor: "pointer" }}>
        {BANDS.map(b => {
          const x1 = toX(b.startMhz), x2 = toX(b.endMhz);
          const w = Math.max(x2 - x1, 4);
          return (
            <g key={b.name} onClick={() => setSelected(b)}>
              <rect x={x1} y={8} width={w} height={44} fill={b.color} opacity={selected?.name===b.name ? 1 : 0.7} rx={2} />
              {w > 18 && <text x={x1 + w/2} y={34} textAnchor="middle" fontSize={10} fill="#fff">{b.name}</text>}
            </g>
          );
        })}
      </svg>
      {selected && (
        <div style={{ marginTop: 12, padding: 12, background: "#1c1c2c", borderRadius: 6, border: `1px solid ${selected.color}` }}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: selected.color }}>{selected.name}</div>
          <div style={{ color: "#ccc", marginTop: 4 }}>{selected.startMhz} – {selected.endMhz} MHz</div>
          <div style={{ color: "#aaa", marginTop: 4, fontSize: 13 }}>{selected.use}</div>
        </div>
      )}
    </div>
  );
}
