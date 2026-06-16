import { useState } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { FrequencyInput } from "../../components/FrequencyInput";
import "./AntennaCalc.css";

const C = 299_792_458;

type AntennaType = "dipole" | "quarter" | "yagi3" | "yagi5" | "loop";

const ANTENNA_TYPES: { id: AntennaType; label: string }[] = [
  { id: "dipole",  label: "½λ Dipole" },
  { id: "quarter", label: "¼λ Vertical" },
  { id: "yagi3",  label: "3-el Yagi" },
  { id: "yagi5",  label: "5-el Yagi" },
  { id: "loop",   label: "Full-wave Loop" },
];

function wl(freqHz: number): number { return C / freqHz; } // meters

interface Elements {
  reflector?: number;
  driven: number;
  directors?: number[];
}

function calcElements(type: AntennaType, freqHz: number): Elements {
  const λ = wl(freqHz);
  switch (type) {
    case "dipole":   return { driven: λ * 0.475 };
    case "quarter":  return { driven: λ * 0.25 };
    case "loop":     return { driven: λ };
    case "yagi3":    return { reflector: λ * 0.505, driven: λ * 0.475, directors: [λ * 0.452] };
    case "yagi5":    return { reflector: λ * 0.505, driven: λ * 0.475, directors: [λ * 0.452, λ * 0.435, λ * 0.424] };
  }
}

function m2ft(m: number): string { return (m * 3.28084).toFixed(3); }
function fmtM(m: number): string { return m.toFixed(3); }

// ── SVG Antenna Diagram ───────────────────────────────────────────────────────

const W = 400, H = 260, CX = 200, GY = 220;

interface DiagramProps {
  type: AntennaType;
  elems: Elements;
  freqHz: number;
}

function AntennaDiagram({ type, elems, freqHz }: DiagramProps) {
  const λ = wl(freqHz);
  const scale = Math.min(140 / (λ / 2), 200); // px per meter, capped

  if (type === "dipole") {
    const armPx = (elems.driven / 2) * scale;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="ant-svg">
        <rect width={W} height={H} fill="rgba(8,18,28,0.88)" />
        {/* Mast */}
        <line x1={CX} y1={GY} x2={CX} y2={100} stroke="rgba(14,165,206,0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Dipole arms */}
        <line x1={CX - armPx} y1={100} x2={CX + armPx} y2={100} stroke="#0EA5CE" strokeWidth="3" strokeLinecap="round" />
        {/* Feed point */}
        <circle cx={CX} cy={100} r={5} fill="#0EA5CE" />
        {/* Dimension lines */}
        <DimLine x1={CX} y1={120} x2={CX + armPx} y2={120} label={`${fmtM(elems.driven / 2)} m each arm`} />
        <DimLine x1={CX - armPx} y1={140} x2={CX + armPx} y2={140} label={`Total ${fmtM(elems.driven)} m`} />
        <Label x={CX} y={85} text="½λ Dipole" />
        <Label x={CX} y={175} text={`= ${m2ft(elems.driven)} ft total · f = ${(freqHz / 1e6).toFixed(3)} MHz`} small />
      </svg>
    );
  }

  if (type === "quarter") {
    const vertPx = elems.driven * scale;
    const radialPx = elems.driven * 0.95 * scale;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="ant-svg">
        <rect width={W} height={H} fill="rgba(8,18,28,0.88)" />
        {/* Ground plane */}
        <line x1={40} y1={GY} x2={W - 40} y2={GY} stroke="rgba(14,165,206,0.25)" strokeWidth="1.5" />
        {/* Radials */}
        {[-1, -0.5, 0.5, 1].map((r, i) => {
          const rx = CX + r * radialPx;
          const ry = GY + Math.abs(r) * 20;
          return <line key={i} x1={CX} y1={GY} x2={rx} y2={ry} stroke="rgba(14,165,206,0.5)" strokeWidth="1.5" strokeLinecap="round" />;
        })}
        {/* Vertical element */}
        <line x1={CX} y1={GY} x2={CX} y2={GY - vertPx} stroke="#0EA5CE" strokeWidth="3" strokeLinecap="round" />
        {/* Tip dot */}
        <circle cx={CX} cy={GY - vertPx} r={4} fill="#0EA5CE" />
        {/* Dimension */}
        <DimLine x1={CX + 10} y1={GY} x2={CX + 10} y2={GY - vertPx} label={`${fmtM(elems.driven)} m`} vertical />
        <Label x={CX} y={GY - vertPx - 12} text="¼λ Vertical" />
        <Label x={CX} y={240} text={`${fmtM(elems.driven)} m · ${m2ft(elems.driven)} ft`} small />
      </svg>
    );
  }

  if (type === "loop") {
    const r = Math.min(80, (elems.driven / (2 * Math.PI)) * scale);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="ant-svg">
        <rect width={W} height={H} fill="rgba(8,18,28,0.88)" />
        <circle cx={CX} cy={120} r={r} stroke="#0EA5CE" strokeWidth="3" fill="none" />
        <circle cx={CX} cy={120 + r} r={5} fill="#0EA5CE" />
        <Label x={CX} y={120} text="Full-wave Loop" />
        <Label x={CX} y={235} text={`Circumference ${fmtM(elems.driven)} m · ${m2ft(elems.driven)} ft`} small />
        <DimLine x1={CX} y1={120} x2={CX + r} y2={120} label={`r=${fmtM(elems.driven / (2 * Math.PI))} m`} />
      </svg>
    );
  }

  // Yagi
  const refPx  = elems.reflector ? (elems.reflector / 2) * scale : 0;
  const drvPx  = (elems.driven / 2) * scale;
  const dirPx  = elems.directors ? elems.directors.map((d) => (d / 2) * scale) : [];
  const spacing = Math.min(50, λ * 0.2 * scale);

  const drvX = CX;
  const dirXs: number[] = dirPx.map((_, i) => CX + spacing * (i + 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ant-svg">
      <rect width={W} height={H} fill="rgba(8,18,28,0.88)" />
      {/* Boom */}
      <line x1={drvX - spacing - 20} y1={120} x2={drvX + spacing * dirXs.length + 20} y2={120} stroke="rgba(14,165,206,0.3)" strokeWidth="2" />
      {/* Reflector */}
      {elems.reflector && (
        <>
          <line x1={drvX - spacing} y1={120 - refPx} x2={drvX - spacing} y2={120 + refPx} stroke="rgba(14,165,206,0.65)" strokeWidth="2.5" strokeLinecap="round" />
          <Label x={drvX - spacing} y={82} text="Ref" small />
          <Label x={drvX - spacing} y={175} text={`${fmtM(elems.reflector)} m`} small />
        </>
      )}
      {/* Driven */}
      <line x1={drvX} y1={120 - drvPx} x2={drvX} y2={120 + drvPx} stroke="#0EA5CE" strokeWidth="3" strokeLinecap="round" />
      <circle cx={drvX} cy={120} r={4} fill="#0EA5CE" />
      <Label x={drvX} y={82} text="DE" small />
      <Label x={drvX} y={175} text={`${fmtM(elems.driven)} m`} small />
      {/* Directors */}
      {dirPx.map((dp, i) => (
        <g key={i}>
          <line x1={dirXs[i]} y1={120 - dp} x2={dirXs[i]} y2={120 + dp} stroke="rgba(14,165,206,0.85)" strokeWidth="2" strokeLinecap="round" />
          <Label x={dirXs[i]} y={82} text={`D${i + 1}`} small />
          <Label x={dirXs[i]} y={175} text={`${fmtM((elems.directors ?? [])[i])} m`} small />
        </g>
      ))}
      <Label x={drvX} y={210} text={`${type === "yagi3" ? "3" : "5"}-element Yagi · ${(freqHz / 1e6).toFixed(3)} MHz`} small />
    </svg>
  );
}

// Helper SVG components
function Label({ x, y, text, small }: { x: number; y: number; text: string; small?: boolean }) {
  return (
    <text
      x={x} y={y}
      textAnchor="middle"
      fill={small ? "rgba(14,165,206,0.55)" : "rgba(14,165,206,0.85)"}
      fontSize={small ? 9 : 11.5}
      fontFamily="SF Mono, JetBrains Mono, monospace"
      fontWeight={small ? "400" : "600"}
    >
      {text}
    </text>
  );
}

function DimLine({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(14,165,206,0.35)" strokeWidth="0.75" strokeDasharray="3 2" />
      <text x={vertical ? x2 + 14 : mx} y={vertical ? my + 4 : y1 + (vertical ? 0 : -4)} textAnchor={vertical ? "start" : "middle"} fill="rgba(14,165,206,0.65)" fontSize="9" fontFamily="SF Mono, JetBrains Mono, monospace">{label}</text>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AntennaCalcApp() {
  const [freqHz, setFreqHz] = useState(144_390_000);
  const [type, setType]     = useState<AntennaType>("dipole");

  const freqMhz = freqHz / 1e6;
  const valid   = freqHz > 0 && isFinite(freqHz);
  const elems   = valid ? calcElements(type, freqHz) : null;

  const RESULTS = valid ? [
    { label: "½λ total",    m: wl(freqHz) * 0.475,     ft: m2ft(wl(freqHz) * 0.475) },
    { label: "¼λ element",  m: wl(freqHz) * 0.25,      ft: m2ft(wl(freqHz) * 0.25) },
    { label: "Wavelength λ", m: wl(freqHz),             ft: m2ft(wl(freqHz)) },
    { label: "5/8λ",         m: wl(freqHz) * 0.625,    ft: m2ft(wl(freqHz) * 0.625) },
    { label: "Full-wave loop", m: wl(freqHz) * 1.02,   ft: m2ft(wl(freqHz) * 1.02) },
  ] : [];

  return (
    <AppScreen
      appId="antenna_calc"
      title="Antenna Calculator"
      subtitle="Element Dimensions"
      status="idle"
      statusText={valid ? `${freqMhz.toFixed(3)} MHz · λ = ${fmtM(wl(freqHz))} m` : "Enter frequency"}
      actions={
        <div className="ant-type-tabs">
          {ANTENNA_TYPES.map((t) => (
            <button
              key={t.id}
              className={`ant-type-tab${type === t.id ? " ant-type-tab--on" : ""}`}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
      controls={
        <div className="ant-controls">
          <div className="ant-ctrl-field">
            <label className="ant-ctrl-label">Frequency</label>
            <FrequencyInput hz={freqHz} onChange={setFreqHz} autoUnit />
          </div>
        </div>
      }
    >
      <div className="ant-layout">
        {/* SVG diagram — the hero */}
        <GlassPanel title="Scale Diagram" pad="none" style={{ flexShrink: 0 }}>
          {valid && elems ? (
            <AntennaDiagram type={type} elems={elems} freqHz={freqHz} />
          ) : (
            <div className="ant-diagram-empty">Enter a valid frequency to draw the diagram</div>
          )}
        </GlassPanel>

        {/* Quick reference table */}
        <GlassPanel title="Element Lengths" pad="none">
          <div className="ant-results">
            <div className="ant-results__head">
              <span>Element</span>
              <span>Meters</span>
              <span>Feet</span>
              <span>Inches</span>
            </div>
            {RESULTS.map((r) => (
              <div key={r.label} className="ant-results__row">
                <span className="ant-results__label">{r.label}</span>
                <span className="ant-results__val">{fmtM(r.m)}</span>
                <span className="ant-results__val ant-results__val--ft">{r.ft}</span>
                <span className="ant-results__val ant-results__val--ft">{(parseFloat(r.ft) * 12).toFixed(1)}"</span>
              </div>
            ))}
            {RESULTS.length === 0 && <div className="ant-results__empty">No results — enter a valid frequency</div>}
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
