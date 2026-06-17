import { useState, useId } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./FreqHopper.css";

interface HopEntry {
  key: number;
  hz: number;
}

let _keySeq = 0;
function makeEntry(hz: number): HopEntry {
  return { key: ++_keySeq, hz };
}

const DEFAULT_HOPS: HopEntry[] = [
  makeEntry(144_390_000),
  makeEntry(433_920_000),
  makeEntry(915_000_000),
];

const COMMON_PRESETS = [
  { label: "ISM 433", hz: 433_920_000 },
  { label: "ISM 868", hz: 868_000_000 },
  { label: "ISM 915", hz: 915_000_000 },
  { label: "2m Ham",  hz: 144_390_000 },
];

const SVG_W = 300;
const SVG_H = 100;
const PAD_X = 24;
const PIN_TOP = 18;
const PIN_BOT = 82;
const AXIS_Y = PIN_BOT;

function fmtMhz(hz: number) {
  return `${(hz / 1e6).toFixed(3)}`;
}

function SpectrumHopMap({ hops }: { hops: HopEntry[] }) {
  const valid = hops.filter((h) => h.hz > 0);
  if (valid.length === 0) {
    return (
      <div className="hop-tx__map-empty">Add at least one frequency to see the hop map</div>
    );
  }

  const minHz = Math.min(...valid.map((h) => h.hz));
  const maxHz = Math.max(...valid.map((h) => h.hz));
  const rangeHz = maxHz - minHz || 1;
  const pad = rangeHz * 0.15;

  const toX = (hz: number) =>
    PAD_X + ((hz - (minHz - pad)) / (rangeHz + 2 * pad)) * (SVG_W - 2 * PAD_X);

  const positions = valid.map((h) => ({
    ...h,
    x: toX(h.hz),
  }));

  // Zigzag path connecting pin tops in sequence
  const zigzagPts = positions.map((p) => `${p.x},${PIN_TOP}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="hop-tx__map-svg"
      aria-label="Frequency hop spectrum map"
    >
      {/* Spectrum background */}
      <rect x={PAD_X} y={PIN_TOP - 2} width={SVG_W - 2 * PAD_X} height={4} rx={2}
        fill="rgba(192,96,0,0.12)" />

      {/* Axis */}
      <line x1={PAD_X} y1={AXIS_Y} x2={SVG_W - PAD_X} y2={AXIS_Y}
        stroke="rgba(192,96,0,0.28)" strokeWidth={1} />

      {/* Frequency span labels */}
      {valid.length > 1 && (
        <>
          <text x={PAD_X} y={SVG_H - 4} className="hop-tx__axis-label" textAnchor="start">
            {fmtMhz(minHz)} MHz
          </text>
          <text x={SVG_W - PAD_X} y={SVG_H - 4} className="hop-tx__axis-label" textAnchor="end">
            {fmtMhz(maxHz)} MHz
          </text>
        </>
      )}

      {/* Zigzag connecting line */}
      {valid.length > 1 && (
        <polyline
          points={zigzagPts}
          fill="none"
          stroke="rgba(192,96,0,0.50)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      )}

      {/* Pins and badges */}
      {positions.map((p, i) => (
        <g key={p.key}>
          {/* Vertical pin */}
          <line x1={p.x} y1={PIN_TOP} x2={p.x} y2={AXIS_Y}
            stroke="rgba(192,96,0,0.55)" strokeWidth={1.5} />

          {/* Ping dot at top */}
          <circle cx={p.x} cy={PIN_TOP} r={4} fill="#C06000"
            stroke="rgba(255,180,80,0.8)" strokeWidth={0.8} />

          {/* Sequence number badge */}
          <text x={p.x} y={PIN_TOP - 8} className="hop-tx__pin-num" textAnchor="middle">
            {i + 1}
          </text>

          {/* Frequency label at base */}
          <text x={p.x} y={AXIS_Y + 10} className="hop-tx__pin-freq" textAnchor="middle">
            {fmtMhz(p.hz)}
          </text>
        </g>
      ))}

      {/* "FHSS" watermark */}
      <text x={SVG_W / 2} y={SVG_H / 2 + 6} className="hop-tx__fhss-mark" textAnchor="middle">
        FHSS
      </text>
    </svg>
  );
}

export function FreqHopperApp() {
  const [hops, setHops] = useState<HopEntry[]>(DEFAULT_HOPS);
  const [vgaGain, setVgaGain] = useState(20);
  const inputId = useId();

  const validHops = hops.filter((h) => h.hz > 0);
  const frequencies_hz = validHops.map((h) => h.hz);

  const addHop = (hz: number) =>
    setHops((prev) => [...prev, makeEntry(hz)]);

  const removeHop = (key: number) =>
    setHops((prev) => prev.filter((h) => h.key !== key));

  const updateHz = (key: number, hz: number) =>
    setHops((prev) => prev.map((h) => (h.key === key ? { ...h, hz } : h)));

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setHops((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === hops.length - 1) return;
    setHops((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  return (
    <AppScreen
      appId="freq_hopper"
      title="Frequency Hopper"
      subtitle={`${validHops.length} hop${validHops.length !== 1 ? "s" : ""} · FHSS`}
      status="idle"
      statusText="Disarmed"
    >
      <div className="hop-tx__layout">
        {/* Left — hop sequence editor */}
        <GlassPanel title="Hop Sequence" size="fill" pad="sm" className="hop-tx__seq-panel">
          <div className="hop-tx__seq-list">
            {hops.map((hop, idx) => (
              <div key={hop.key} className="hop-tx__hop-row">
                <span className="hop-tx__hop-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                <div className="hop-tx__hz-wrap">
                  <input
                    id={`${inputId}-${hop.key}`}
                    className="hop-tx__hz-input"
                    type="number"
                    value={hop.hz || ""}
                    min={1_000_000}
                    max={6_000_000_000}
                    step={1000}
                    placeholder="Hz"
                    onChange={(e) => updateHz(hop.key, parseFloat(e.target.value) || 0)}
                  />
                  <span className="hop-tx__hz-mhz">
                    {hop.hz > 0 ? `${fmtMhz(hop.hz)} MHz` : "—"}
                  </span>
                </div>

                <div className="hop-tx__hop-actions">
                  <button
                    className="hop-tx__order-btn"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    aria-label="Move up"
                  >▲</button>
                  <button
                    className="hop-tx__order-btn"
                    onClick={() => moveDown(idx)}
                    disabled={idx === hops.length - 1}
                    aria-label="Move down"
                  >▼</button>
                  <button
                    className="hop-tx__remove-btn"
                    onClick={() => removeHop(hop.key)}
                    aria-label="Remove hop"
                    disabled={hops.length <= 1}
                  >×</button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick-add presets */}
          <div className="hop-tx__add-row">
            <span className="hop-tx__add-label">Add</span>
            {COMMON_PRESETS.map((p) => (
              <button key={p.label} className="hop-tx__add-btn" onClick={() => addHop(p.hz)}>
                {p.label}
              </button>
            ))}
            <button className="hop-tx__add-btn hop-tx__add-btn--custom" onClick={() => addHop(0)}>
              Custom
            </button>
          </div>

          {/* VGA gain */}
          <div className="hop-tx__gain-row">
            <label className="hop-tx__field-label">TX VGA · {vgaGain} dB</label>
            <input
              type="range"
              className="hop-tx__slider"
              min={0}
              max={47}
              value={vgaGain}
              onChange={(e) => setVgaGain(+e.target.value)}
            />
          </div>
        </GlassPanel>

        {/* Right — spectrum hop map hero */}
        <GlassPanel title="Spectrum Hop Map" size="fill" pad="sm" className="hop-tx__map-panel">
          <SpectrumHopMap hops={validHops} />
          <div className="hop-tx__map-stats">
            <span className="hop-tx__map-stat">
              <span className="hop-tx__stat-key">HOPS</span>
              <span className="hop-tx__stat-val">{validHops.length}</span>
            </span>
            {validHops.length > 1 && (
              <>
                <span className="hop-tx__map-stat">
                  <span className="hop-tx__stat-key">MIN</span>
                  <span className="hop-tx__stat-val">{fmtMhz(Math.min(...validHops.map(h => h.hz)))} MHz</span>
                </span>
                <span className="hop-tx__map-stat">
                  <span className="hop-tx__stat-key">MAX</span>
                  <span className="hop-tx__stat-val">{fmtMhz(Math.max(...validHops.map(h => h.hz)))} MHz</span>
                </span>
              </>
            )}
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="freq_hopper"
        buildParams={() => ({
          frequencies_hz,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="indoor-only"
        transmitLabel="HOP"
      />

      <RecordBar
        appId={"freq_hopper" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
      />
    </AppScreen>
  );
}
