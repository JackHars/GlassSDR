import { useRef, useEffect, useState } from "react";
import "./StatReadout.css";

type Trend = "up" | "down" | "flat" | "none";

interface StatReadoutProps {
  label: string;
  value?: number | string | null;
  unit?: string;
  trend?: Trend;
  peak?: number | null;
  digits?: number;
  size?: "sm" | "md" | "lg";
  mono?: boolean;
}

/** Large monospace metric display — S-meter, dBm, freq counter, baud rate. */
export function StatReadout({
  label,
  value,
  unit,
  trend = "none",
  peak,
  digits = 1,
  size = "md",
  mono = true,
}: StatReadoutProps) {
  const isEmpty = value === null || value === undefined || value === "";
  const formatted = isEmpty
    ? "—"
    : typeof value === "number"
    ? value.toFixed(digits)
    : String(value);

  const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : trend === "flat" ? "━" : null;

  return (
    <div className={`stat-readout stat-readout--${size}`} data-empty={isEmpty || undefined}>
      <span className="stat-readout__label">{label}</span>
      <div className="stat-readout__value-row">
        <span className={`stat-readout__value${mono ? " stat-readout__value--mono" : ""}`}>
          {formatted}
        </span>
        {unit && !isEmpty && <span className="stat-readout__unit">{unit}</span>}
        {trendIcon && !isEmpty && (
          <span className={`stat-readout__trend stat-readout__trend--${trend}`}>{trendIcon}</span>
        )}
      </div>
      {peak !== null && peak !== undefined && !isEmpty && (
        <span className="stat-readout__peak">pk {typeof peak === "number" ? peak.toFixed(digits) : peak}</span>
      )}
    </div>
  );
}

/* ── Gauge ─────────────────────────────────────────────────────────────────
   SVG arc meter: value range [min, max], peak-hold notch, accent colour.
   The arc sweeps 240° (from 150° to 390° = 30°) around a centre point.
   ────────────────────────────────────────────────────────────────────────── */

interface GaugeProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  peak?: number | null;
  unit?: string;
  size?: number;
  segments?: number;
  showValue?: boolean;
}

const SWEEP = 240;
const START_DEG = 150;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function Gauge({
  label,
  value,
  min = 0,
  max = 100,
  peak = null,
  unit,
  size = 120,
  showValue = true,
}: GaugeProps) {
  const peakPct = peak !== null ? Math.min(Math.max((peak - min) / (max - min), 0), 1) : null;

  const cx = size / 2;
  const cy = size * 0.56;
  const r = size * 0.38;
  const strokeW = size * 0.07;

  const startDeg = START_DEG;
  const peakDeg = peakPct !== null ? startDeg + SWEEP * peakPct : null;
  const trackEndDeg = startDeg + SWEEP;

  const needleLen = r * 0.85;

  const displayVal = typeof value === "number" ? (Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)) : value;

  // Animated value for smooth sweep
  const [animVal, setAnimVal] = useState(value);
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef(value);
  useEffect(() => {
    const target = value;
    const step = () => {
      const diff = target - currentRef.current;
      if (Math.abs(diff) < 0.01) { currentRef.current = target; setAnimVal(target); return; }
      currentRef.current += diff * 0.18;
      setAnimVal(currentRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const animPct = Math.min(Math.max((animVal - min) / (max - min), 0), 1);
  const animEnd = startDeg + SWEEP * animPct;
  const animNeedle = polarToCartesian(cx, cy, needleLen, animEnd);

  return (
    <div className="gauge" style={{ width: size, flexShrink: 0 }}>
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        {/* Track (background arc) */}
        <path
          d={arcPath(cx, cy, r, startDeg, trackEndDeg)}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {animPct > 0.005 && (
          <path
            d={arcPath(cx, cy, r, startDeg, animEnd)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 3px var(--accent-glow))" }}
          />
        )}
        {/* Peak-hold notch */}
        {peakDeg !== null && (
          <path
            d={arcPath(cx, cy, r, peakDeg - 2, peakDeg + 2)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={strokeW * 1.1}
            strokeLinecap="butt"
            opacity={0.5}
          />
        )}
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={animNeedle.x}
          y2={animNeedle.y}
          stroke="var(--accent)"
          strokeWidth={size * 0.022}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
        />
        {/* Pivot dot */}
        <circle cx={cx} cy={cy} r={size * 0.04} fill="var(--accent)" />
      </svg>
      {showValue && (
        <div className="gauge__value-row">
          <span className="gauge__value">{displayVal}</span>
          {unit && <span className="gauge__unit">{unit}</span>}
        </div>
      )}
      {label && <span className="gauge__label">{label}</span>}
    </div>
  );
}
