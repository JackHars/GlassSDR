import { useState, useCallback } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./OokEditorTx.css";

const COLS = 16;
const ROWS = 4;
const TOTAL = COLS * ROWS; // 64 bits

function makeDefault(): number[] {
  // Preamble-like: alt 1010, then sync 0000 1111 0000 1111, then repeat
  const p: number[] = [];
  for (let i = 0; i < TOTAL; i++) {
    if (i < 16) p.push(i % 2);           // preamble: 1010...
    else if (i < 24) p.push(0);           // low gap
    else if (i < 32) p.push(1);           // high burst
    else if (i < 40) p.push(0);           // low gap
    else if (i < 48) p.push(1);           // data
    else p.push(i % 3 === 0 ? 1 : 0);    // mixed end
  }
  return p;
}

const PRESETS: { label: string; fn: () => number[] }[] = [
  { label: "Clear", fn: () => Array(TOTAL).fill(0) },
  { label: "Fill",  fn: () => Array(TOTAL).fill(1) },
  { label: "Alt",   fn: () => Array.from({ length: TOTAL }, (_, i) => i % 2) },
  { label: "PWM",   fn: () => Array.from({ length: TOTAL }, (_, i) => i % 4 < 3 ? 1 : 0) },
];

/** Live square-wave SVG from a bit array. */
function SquareWave({ bits }: { bits: number[] }) {
  if (bits.length === 0) return null;

  const W = 560;
  const H = 40;
  const cellW = W / bits.length;
  const TOP = 6;
  const BOT = H - 6;

  // Build polyline points
  const pts: string[] = [];
  let prev = bits[0];
  pts.push(`0,${prev ? TOP : BOT}`);

  bits.forEach((b, i) => {
    const x = i * cellW;
    if (b !== prev) {
      pts.push(`${x},${prev ? TOP : BOT}`);
      pts.push(`${x},${b ? TOP : BOT}`);
      prev = b;
    }
    if (i === bits.length - 1) {
      pts.push(`${(i + 1) * cellW},${b ? TOP : BOT}`);
    }
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="ook-tx__wave-svg"
      aria-label="OOK square wave preview"
      preserveAspectRatio="none"
    >
      {/* Zero line */}
      <line x1={0} y1={BOT} x2={W} y2={BOT} stroke="rgba(200,128,0,0.12)" strokeWidth={0.5} />
      {/* One line */}
      <line x1={0} y1={TOP} x2={W} y2={TOP} stroke="rgba(200,128,0,0.12)" strokeWidth={0.5} />

      {/* Fill under waveform */}
      <polyline
        points={[...pts, `${W},${BOT}`, `0,${BOT}`].join(" ")}
        fill="rgba(200,128,0,0.10)"
        stroke="none"
      />

      {/* Waveform line */}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="rgba(200,128,0,0.85)"
        strokeWidth={1.5}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function OokEditorTxApp() {
  const [bits, setBits] = useState<number[]>(makeDefault);
  const [frequency, setFrequency] = useState("433920000");
  const [vgaGain, setVgaGain] = useState(20);
  const [paintVal, setPaintVal] = useState<number | null>(null);

  const toggleBit = useCallback((idx: number, forceVal?: number) => {
    setBits((prev) => {
      const next = [...prev];
      next[idx] = forceVal ?? (prev[idx] ? 0 : 1);
      return next;
    });
  }, []);

  const handleCellDown = (idx: number) => {
    const newVal = bits[idx] ? 0 : 1;
    setPaintVal(newVal);
    toggleBit(idx, newVal);
  };

  const handleCellEnter = (idx: number) => {
    if (paintVal !== null) toggleBit(idx, paintVal);
  };

  const handleMouseUp = () => setPaintVal(null);

  const freqNum = parseFloat(frequency) || 0;
  const oneCount = bits.filter(Boolean).length;
  const zeroCount = TOTAL - oneCount;

  return (
    <AppScreen
      appId="ook_editor_tx"
      title="OOK Editor"
      subtitle="On-Off Keying · pulse editor"
      status="idle"
      statusText="Disarmed"
    >
      {/* Controls row */}
      <div className="ook-tx__controls">
        <div className="ook-tx__field">
          <label className="ook-tx__field-label">Frequency</label>
          <div className="ook-tx__input-wrap">
            <input
              className="ook-tx__input"
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
            <span className="ook-tx__input-suffix">Hz</span>
          </div>
          {freqNum > 0 && (
            <span className="ook-tx__field-sub">{(freqNum / 1e6).toFixed(4)} MHz</span>
          )}
        </div>

        <div className="ook-tx__field ook-tx__field--gain">
          <label className="ook-tx__field-label">TX VGA · {vgaGain} dB</label>
          <input
            type="range"
            className="ook-tx__slider"
            min={0}
            max={47}
            value={vgaGain}
            onChange={(e) => setVgaGain(+e.target.value)}
          />
        </div>

        <div className="ook-tx__stats">
          <span className="ook-tx__stat">
            <span className="ook-tx__stat-key">BITS</span>
            <span className="ook-tx__stat-val">{TOTAL}</span>
          </span>
          <span className="ook-tx__stat">
            <span className="ook-tx__stat-key">HIGH</span>
            <span className="ook-tx__stat-val">{oneCount}</span>
          </span>
          <span className="ook-tx__stat">
            <span className="ook-tx__stat-key">LOW</span>
            <span className="ook-tx__stat-val">{zeroCount}</span>
          </span>
        </div>

        {/* Presets */}
        <div className="ook-tx__presets">
          {PRESETS.map((p) => (
            <button key={p.label} className="ook-tx__preset-btn" onClick={() => setBits(p.fn())}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bit grid + wave hero */}
      <GlassPanel title="Pulse Pattern" size="fill" pad="md" className="ook-tx__editor-panel">
        {/* Bit cell grid */}
        <div
          className="ook-tx__grid"
          onMouseLeave={() => setPaintVal(null)}
          onMouseUp={handleMouseUp}
        >
          {/* Column index header */}
          <div className="ook-tx__grid-header">
            {Array.from({ length: COLS }, (_, i) => (
              <span key={i} className="ook-tx__col-idx">{i}</span>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="ook-tx__grid-row">
              <span className="ook-tx__row-idx">{row * COLS}</span>
              {Array.from({ length: COLS }, (_, col) => {
                const idx = row * COLS + col;
                const v = bits[idx];
                return (
                  <div
                    key={col}
                    className={`ook-tx__cell${v ? " ook-tx__cell--hi" : ""}`}
                    onMouseDown={() => handleCellDown(idx)}
                    onMouseEnter={() => handleCellEnter(idx)}
                    title={`bit[${idx}] = ${v}`}
                    role="checkbox"
                    aria-checked={!!v}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggleBit(idx);
                      }
                    }}
                  >
                    {v ? "1" : "0"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Square-wave live preview */}
        <div className="ook-tx__wave-wrap">
          <span className="ook-tx__wave-label">Square wave</span>
          <SquareWave bits={bits} />
          <div className="ook-tx__wave-axis">
            <span>0</span>
            <span>{TOTAL} symbols</span>
          </div>
        </div>
      </GlassPanel>

      <ArmConsole
        appId="ook_editor_tx"
        buildParams={() => ({
          center_hz: freqNum,
          pattern: bits,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"ook_editor_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freqNum || undefined}
      />
    </AppScreen>
  );
}
