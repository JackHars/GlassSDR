import { useState, useCallback } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./Calculator.css";

const C = 299_792_458; // m/s

// ── Math helpers ─────────────────────────────────────────────────────────────

function wl(freqHz: number): number { return freqHz > 0 ? (C / freqHz) * 100 : NaN; }
function fspl(distKm: number, freqHz: number): number {
  if (distKm <= 0 || freqHz <= 0) return NaN;
  return 20 * Math.log10(distKm * 1000) + 20 * Math.log10(freqHz) - 147.55;
}
function dbmToMw(dbm: number): number { return Math.pow(10, dbm / 10); }
function mwToDbm(mw: number): number { return 10 * Math.log10(mw); }
function linkBudget(txDbm: number, txGainDbi: number, pathLossDb: number, rxGainDbi: number): number {
  return txDbm + txGainDbi - pathLossDb + rxGainDbi;
}

function fmt(n: number, digits = 3): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  return n.toFixed(digits);
}

// ── Result tile ───────────────────────────────────────────────────────────────

function ResultTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="calc-result">
      <span className="calc-result__label">{label}</span>
      <div className="calc-result__val-row">
        <span className="calc-result__val">{value}</span>
        {unit && value !== "—" && <span className="calc-result__unit">{unit}</span>}
      </div>
    </div>
  );
}

// ── Input row ─────────────────────────────────────────────────────────────────

function CalcInput({ label, value, onChange, placeholder, unit }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <div className="calc-input-wrap">
      <label className="calc-input-label">{label}</label>
      <div className="calc-input-row">
        <input
          className="calc-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {unit && <span className="calc-input-unit">{unit}</span>}
      </div>
    </div>
  );
}

// ── RF Engineering Tab ────────────────────────────────────────────────────────

function RfEngTab() {
  const [freqMhz, setFreqMhz] = useState("144.39");
  const [distKm,  setDistKm]  = useState("10");
  const [dbm,     setDbm]     = useState("20");
  const [mw,      setMw]      = useState("");
  const [txDbm,   setTxDbm]   = useState("30");
  const [txGain,  setTxGain]  = useState("2");
  const [rxGain,  setRxGain]  = useState("2");

  const f = parseFloat(freqMhz) * 1e6;
  const d = parseFloat(distKm);
  const pDbm = parseFloat(dbm);
  const pMw  = parseFloat(mw);
  const pl   = fspl(d, f);

  return (
    <div className="calc-rf-layout">
      {/* Frequency & Wavelength */}
      <GlassPanel title="Frequency" pad="md">
        <div className="calc-card">
          <CalcInput label="Frequency" value={freqMhz} onChange={setFreqMhz} placeholder="144.39" unit="MHz" />
          <div className="calc-results-row">
            <ResultTile label="Wavelength" value={fmt(wl(f), 2)} unit="cm" />
            <ResultTile label="Wavelength λ/4" value={fmt(wl(f) / 4, 2)} unit="cm" />
          </div>
        </div>
      </GlassPanel>

      {/* FSPL */}
      <GlassPanel title="Free-Space Path Loss" pad="md">
        <div className="calc-card">
          <div className="calc-two-col">
            <CalcInput label="Frequency" value={freqMhz} onChange={setFreqMhz} placeholder="144.39" unit="MHz" />
            <CalcInput label="Distance" value={distKm} onChange={setDistKm} placeholder="10" unit="km" />
          </div>
          <div className="calc-results-row">
            <ResultTile label="Path Loss" value={fmt(pl, 1)} unit="dB" />
          </div>
        </div>
      </GlassPanel>

      {/* Power conversion */}
      <GlassPanel title="Power Conversion" pad="md">
        <div className="calc-card">
          <div className="calc-two-col">
            <CalcInput label="Power (dBm)" value={dbm} onChange={(v) => { setDbm(v); setMw(""); }} placeholder="20" />
            <CalcInput label="Power (mW)" value={mw} onChange={(v) => { setMw(v); setDbm(""); }} placeholder="100" />
          </div>
          <div className="calc-results-row">
            {dbm && !mw && <ResultTile label="mW" value={fmt(dbmToMw(pDbm), 2)} unit="mW" />}
            {mw && !dbm && <ResultTile label="dBm" value={fmt(mwToDbm(pMw), 2)} unit="dBm" />}
            {dbm && mw && <ResultTile label="mW" value={fmt(dbmToMw(pDbm), 2)} unit="mW" />}
          </div>
        </div>
      </GlassPanel>

      {/* Link budget */}
      <GlassPanel title="Link Budget" pad="md">
        <div className="calc-card">
          <div className="calc-two-col">
            <CalcInput label="TX Power" value={txDbm} onChange={setTxDbm} placeholder="30" unit="dBm" />
            <CalcInput label="TX Antenna" value={txGain} onChange={setTxGain} placeholder="2" unit="dBi" />
          </div>
          <div className="calc-two-col">
            <CalcInput label="Distance" value={distKm} onChange={setDistKm} placeholder="10" unit="km" />
            <CalcInput label="RX Antenna" value={rxGain} onChange={setRxGain} placeholder="2" unit="dBi" />
          </div>
          <div className="calc-results-row">
            <ResultTile
              label="Received Signal"
              value={isFinite(pl) ? fmt(linkBudget(parseFloat(txDbm), parseFloat(txGain), pl, parseFloat(rxGain)), 1) : "—"}
              unit="dBm"
            />
            <ResultTile label="Path Loss" value={fmt(pl, 1)} unit="dB" />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

// ── Expression Tab ────────────────────────────────────────────────────────────

function ExprTab() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const evaluate = useCallback(() => {
    if (!expr.trim()) { setResult(null); return; }
    try {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict"; const MHz=1e6,kHz=1e3,GHz=1e9,C=${C}; return (${expr})`)();
      setResult(typeof r === "number" ? r.toPrecision(10).replace(/\.?0+$/, "") : String(r));
    } catch { setResult("Syntax error"); }
  }, [expr]);

  return (
    <GlassPanel title="Expression" pad="md">
      <div className="calc-expr">
        <input
          className="calc-expr__input"
          type="text"
          value={expr}
          onChange={(e) => { setExpr(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && evaluate()}
          placeholder="(144.39e6 / 2) + 1e3 · MHz · kHz · GHz · C available"
          spellCheck={false}
        />
        <button className="calc-expr__btn" onClick={evaluate}>= Evaluate</button>
        {result !== null && (
          <div className={`calc-expr__result${result === "Syntax error" ? " calc-expr__result--err" : ""}`}>
            {result}
          </div>
        )}
        <div className="calc-expr__hint">
          Constants: MHz = 1e6 · kHz = 1e3 · GHz = 1e9 · C = speed of light
        </div>
      </div>
    </GlassPanel>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CalculatorApp() {
  const [tab, setTab] = useState<"rf" | "expr">("rf");

  return (
    <AppScreen
      appId="calculator"
      title="RF Calculator"
      subtitle="Engineering Pad"
      status="idle"
      statusText="Live compute · no Calculate button needed"
      actions={
        <div className="calc-tabs">
          <button
            className={`calc-tab${tab === "rf" ? " calc-tab--on" : ""}`}
            onClick={() => setTab("rf")}
          >
            RF Engineering
          </button>
          <button
            className={`calc-tab${tab === "expr" ? " calc-tab--on" : ""}`}
            onClick={() => setTab("expr")}
          >
            Expression
          </button>
        </div>
      }
    >
      <div className="calc-layout">
        {tab === "rf" ? <RfEngTab /> : <ExprTab />}
      </div>
    </AppScreen>
  );
}
