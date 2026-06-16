import { useState } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./BandPlan.css";

interface Band {
  name: string;
  startMhz: number;
  endMhz: number;
  color: string;
  category: string;
  use: string;
  region?: "all" | "1" | "2" | "3";
}

const AMATEUR: Band[] = [
  { name: "160m", startMhz: 1.8,    endMhz: 2.0,    color: "#22c55e", category: "Amateur",   use: "SSB, CW — DX nightly" },
  { name: "80m",  startMhz: 3.5,    endMhz: 4.0,    color: "#3b82f6", category: "Amateur",   use: "SSB, CW, digital" },
  { name: "60m",  startMhz: 5.33,   endMhz: 5.405,  color: "#64748b", category: "Amateur",   use: "USB channels only (Region 2)" },
  { name: "40m",  startMhz: 7.0,    endMhz: 7.3,    color: "#f97316", category: "Amateur",   use: "DX, SSB, CW" },
  { name: "30m",  startMhz: 10.1,   endMhz: 10.15,  color: "#84cc16", category: "Amateur",   use: "CW, digital only" },
  { name: "20m",  startMhz: 14.0,   endMhz: 14.35,  color: "#ec4899", category: "Amateur",   use: "SSB, CW — prime DX" },
  { name: "17m",  startMhz: 18.068, endMhz: 18.168, color: "#06b6d4", category: "Amateur",   use: "SSB, CW" },
  { name: "15m",  startMhz: 21.0,   endMhz: 21.45,  color: "#eab308", category: "Amateur",   use: "SSB, CW" },
  { name: "12m",  startMhz: 24.89,  endMhz: 24.99,  color: "#a855f7", category: "Amateur",   use: "SSB, CW" },
  { name: "10m",  startMhz: 28.0,   endMhz: 29.7,   color: "#0ea5e9", category: "Amateur",   use: "SSB, CW, FM" },
  { name: "6m",   startMhz: 50.0,   endMhz: 54.0,   color: "#10b981", category: "Amateur",   use: "VHF, SSB, CW, FM" },
  { name: "2m",   startMhz: 144.0,  endMhz: 148.0,  color: "#f59e0b", category: "Amateur",   use: "VHF — FM, SSB, satellites" },
  { name: "70cm", startMhz: 420.0,  endMhz: 450.0,  color: "#6366f1", category: "Amateur",   use: "UHF — FM, digital, ATV" },
  { name: "33cm", startMhz: 902.0,  endMhz: 928.0,  color: "#d946ef", category: "Amateur",   use: "UHF — digital, ISM overlap" },
  { name: "23cm", startMhz: 1240.0, endMhz: 1300.0, color: "#8b5cf6", category: "Amateur",   use: "ATV, weak signal" },
];

const UTILITY: Band[] = [
  { name: "AM BC",      startMhz: 0.530,   endMhz: 1.700,   color: "#78716c", category: "Broadcast",  use: "MW broadcast" },
  { name: "SW",         startMhz: 3.0,     endMhz: 30.0,    color: "#57534e", category: "Broadcast",  use: "International shortwave" },
  { name: "Airband",    startMhz: 118.0,   endMhz: 137.0,   color: "#0ea5e9", category: "Aviation",   use: "ATC voice, ADS-B at 1090" },
  { name: "FM BC",      startMhz: 87.5,    endMhz: 108.0,   color: "#e879f9", category: "Broadcast",  use: "Stereo FM + RDS" },
  { name: "VHF Mar",    startMhz: 156.0,   endMhz: 174.0,   color: "#0284c7", category: "Maritime",   use: "Ch 16 = 156.800 MHz DSC/distress" },
  { name: "ISM 433",    startMhz: 433.05,  endMhz: 434.79,  color: "#f59e0b", category: "ISM",        use: "OOK remotes, keyfobs, sensors" },
  { name: "ISM 868",    startMhz: 868.0,   endMhz: 868.6,   color: "#fb923c", category: "ISM",        use: "LoRa, Z-Wave, Sigfox (EU)" },
  { name: "ISM 915",    startMhz: 902.0,   endMhz: 928.0,   color: "#ef4444", category: "ISM",        use: "LoRa, 802.15.4 (Americas)" },
  { name: "GPS L1",     startMhz: 1575.42, endMhz: 1575.42, color: "#16a34a", category: "Satellite",  use: "GPS/GNSS civil L1 C/A" },
  { name: "ISM 2.4G",   startMhz: 2400.0,  endMhz: 2483.5,  color: "#3b82f6", category: "ISM",        use: "Wi-Fi, BLE, Zigbee, nRF24" },
];

const ALL_BANDS = [...AMATEUR, ...UTILITY];

type View = "amateur" | "all";

const MIN_MHZ = 0.1, MAX_MHZ = 3000;
const SVG_W = 1000;

function toX(mhz: number): number {
  const logMin = Math.log10(MIN_MHZ);
  const logMax = Math.log10(MAX_MHZ);
  return ((Math.log10(Math.max(mhz, MIN_MHZ)) - logMin) / (logMax - logMin)) * SVG_W;
}

const RULER_TICKS = [0.5, 1, 2, 5, 10, 30, 50, 100, 150, 300, 500, 1000, 2000, 3000];

export function BandPlanApp() {
  const [view, setView] = useState<View>("all");
  const [selected, setSelected] = useState<Band | null>(null);

  const bands = view === "amateur" ? AMATEUR : ALL_BANDS;

  return (
    <AppScreen
      appId="band_plan"
      title="Band Plan"
      subtitle="Spectrum Reference"
      status="idle"
      statusText={`${bands.length} allocations · ${view === "all" ? "all categories" : "amateur only"}`}
      actions={
        <div className="bp-view-tabs">
          <button
            className={`bp-view-tab${view === "all" ? " bp-view-tab--on" : ""}`}
            onClick={() => setView("all")}
          >
            All Bands
          </button>
          <button
            className={`bp-view-tab${view === "amateur" ? " bp-view-tab--on" : ""}`}
            onClick={() => setView("amateur")}
          >
            Amateur
          </button>
        </div>
      }
    >
      <div className="bp-layout">
        {/* Ruler SVG */}
        <GlassPanel title="Spectrum Ruler" pad="none">
          <div className="bp-ruler-wrap">
            <svg
              className="bp-ruler-svg"
              viewBox={`0 0 ${SVG_W} 90`}
              preserveAspectRatio="none"
            >
              {/* Background */}
              <rect width={SVG_W} height={90} fill="rgba(10,16,28,0.88)" />

              {/* Ruler ticks */}
              {RULER_TICKS.map((mhz) => {
                const x = toX(mhz);
                const label = mhz >= 1000 ? `${mhz / 1000}G` : mhz >= 1 ? `${mhz}M` : `${mhz * 1000}k`;
                return (
                  <g key={mhz}>
                    <line x1={x} y1="0" x2={x} y2="22" stroke="rgba(26,110,204,0.4)" strokeWidth="0.75" />
                    <text x={x} y="32" textAnchor="middle" fill="rgba(26,110,204,0.55)" fontSize="8.5" fontFamily="SF Mono, JetBrains Mono, monospace">{label}</text>
                  </g>
                );
              })}

              {/* Band segments */}
              {bands.map((b) => {
                const x1 = toX(b.startMhz);
                const x2 = b.startMhz === b.endMhz ? x1 + 2 : toX(b.endMhz);
                const w = Math.max(x2 - x1, 4);
                const isSel = selected?.name === b.name;
                const y = 40;
                const h = isSel ? 44 : 36;
                return (
                  <g key={b.name} onClick={() => setSelected(isSel ? null : b)} style={{ cursor: "pointer" }}>
                    <rect
                      x={x1} y={isSel ? y - 4 : y}
                      width={w} height={h}
                      fill={b.color}
                      opacity={isSel ? 1 : 0.8}
                      rx={3}
                    />
                    {w > 20 && (
                      <text
                        x={x1 + w / 2}
                        y={y + h / 2 + 4}
                        textAnchor="middle"
                        fontSize={Math.min(9.5, w / b.name.length)}
                        fontWeight="600"
                        fill="rgba(255,255,255,0.95)"
                        style={{ pointerEvents: "none" }}
                      >
                        {b.name}
                      </text>
                    )}
                    {isSel && (
                      <line x1={x1 + w / 2} y1={y + h} x2={x1 + w / 2} y2={90} stroke={b.color} strokeWidth="1" strokeDasharray="3 2" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </GlassPanel>

        {/* Detail card */}
        {selected ? (
          <GlassPanel
            title={selected.name}
            titleRight={<span className="bp-category-badge" style={{ background: selected.color + "22", color: selected.color }}>{selected.category}</span>}
          >
            <div className="bp-detail">
              <div className="bp-detail__freq">
                <span>{selected.startMhz === selected.endMhz ? selected.startMhz : `${selected.startMhz} – ${selected.endMhz}`}</span>
                <span className="bp-detail__unit">MHz</span>
              </div>
              <div className="bp-detail__bw">
                {selected.startMhz !== selected.endMhz && (
                  <span>Span: {((selected.endMhz - selected.startMhz) * 1000).toFixed(0)} kHz</span>
                )}
              </div>
              <div className="bp-detail__use">{selected.use}</div>
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel title="Band Detail">
            <div className="bp-hint">Tap a segment on the ruler for details</div>
          </GlassPanel>
        )}

        {/* Band list */}
        <GlassPanel title="All Allocations" pad="none" size="fill">
          <div className="bp-band-list">
            {bands.map((b) => (
              <div
                key={b.name}
                className={`bp-band-row${selected?.name === b.name ? " bp-band-row--sel" : ""}`}
                onClick={() => setSelected(selected?.name === b.name ? null : b)}
              >
                <span className="bp-band-swatch" style={{ background: b.color }} />
                <span className="bp-band-name">{b.name}</span>
                <span className="bp-band-freq">
                  {b.startMhz === b.endMhz
                    ? `${b.startMhz} MHz`
                    : `${b.startMhz} – ${b.endMhz} MHz`}
                </span>
                <span className="bp-band-cat">{b.category}</span>
                <span className="bp-band-use">{b.use}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
