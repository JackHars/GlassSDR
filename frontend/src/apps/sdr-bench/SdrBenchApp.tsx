import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { StatReadout, Gauge } from "../../components/kit/StatReadout";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import "./SdrBench.css";

const SAMPLE_RATES = [2, 4, 8, 10, 16, 20] as const;

interface BenchResult {
  sampleRateMsps: number;
  throughputMbps: number;
  droppedSamples: number;
  latencyMs: number;
  pass: boolean;
}

function fmtHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  return `${hz} Hz`;
}

// ── Simulated results (driven locally — backend is a stub) ───────────────────

function simulateResult(sampleRateMsps: number): BenchResult {
  // Deterministic simulation: HackRF is known to be ~20 Msps max
  const passed = sampleRateMsps <= 20;
  const throughputMbps = passed ? sampleRateMsps * 16 : 0; // 16 bits per complex sample
  const dropped = passed ? 0 : Math.round(sampleRateMsps * 1000 * 0.15);
  const latencyMs = passed ? 2 + sampleRateMsps * 0.1 : 0;
  return { sampleRateMsps, throughputMbps, droppedSamples: dropped, latencyMs, pass: passed };
}

// ── Mini Spectrum Strip ───────────────────────────────────────────────────────

interface SpectrumStripProps {
  frame: SpectrumFrame | null;
  running: boolean;
}

function SpectrumStrip({ frame, running }: SpectrumStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(8,14,12,0.9)";
    ctx.fillRect(0, 0, width, height);
    if (!frame || frame.bins.length === 0) {
      ctx.fillStyle = "rgba(76,175,122,0.25)";
      ctx.font = "10px SF Mono, JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(running ? "acquiring…" : "idle", width / 2, height / 2 + 4);
      return;
    }
    const bins = frame.bins;
    const bw = width / bins.length;
    for (let i = 0; i < bins.length; i++) {
      const v = bins[i] / 255;
      const h = v * (height - 2);
      const green = Math.round(100 + v * 75);
      ctx.fillStyle = `rgba(76,${green},100,${(0.4 + v * 0.6).toFixed(2)})`;
      ctx.fillRect(i * bw, height - h, Math.max(1, bw - 0.5), h);
    }
  }, [frame, running]);

  return (
    <canvas
      ref={canvasRef}
      className="bench-spectrum__canvas"
      width={512}
      height={48}
    />
  );
}

// ── Results Table ─────────────────────────────────────────────────────────────

function ResultsTable({ results }: { results: BenchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="bench-table-empty">
        Run a benchmark to populate the results table.
      </div>
    );
  }
  return (
    <div className="bench-table">
      <div className="bench-table__head">
        <span>Sample Rate</span>
        <span>Throughput</span>
        <span>Dropped</span>
        <span>Latency</span>
        <span>Status</span>
      </div>
      {results.map((r) => (
        <div key={r.sampleRateMsps} className={`bench-table__row${r.pass ? "" : " bench-table__row--fail"}`}>
          <span className="bench-table__cell--mono">{r.sampleRateMsps} Msps</span>
          <span className="bench-table__cell--mono">{r.throughputMbps} Mbit/s</span>
          <span className={`bench-table__cell--mono${r.droppedSamples > 0 ? " bench-cell--warn" : ""}`}>
            {r.droppedSamples.toLocaleString()}
          </span>
          <span className="bench-table__cell--mono">{r.pass ? `${r.latencyMs.toFixed(1)} ms` : "—"}</span>
          <span className={`bench-table__status${r.pass ? " bench-table__status--pass" : " bench-table__status--fail"}`}>
            {r.pass ? "PASS" : "FAIL"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SdrBenchApp() {
  const [centerHz, setCenterHz]   = useState(100_000_000);
  const [durationS, setDurationS] = useState(5);
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [results, setResults]     = useState<BenchResult[]>([]);
  const [currentResult, setCurrentResult] = useState<BenchResult | null>(null);
  const [spectrum, setSpectrum]   = useState<SpectrumFrame | null>(null);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ul = listen<SpectrumFrame>("spectrum", (e) => setSpectrum(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    setResults([]);
    setCurrentResult(null);

    await startApp("sdr_benchmark" as AppId, { center_hz: centerHz, duration_s: durationS });

    // Simulate progress and sequential results across sample rates
    const totalMs = durationS * 1000;
    const perRateMs = totalMs / SAMPLE_RATES.length;
    let rateIdx = 0;
    const start = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / totalMs) * 100);
      setProgress(pct);

      const idx = Math.min(Math.floor(elapsed / perRateMs), SAMPLE_RATES.length - 1);
      if (idx !== rateIdx || pct === 100) {
        const newResult = simulateResult(SAMPLE_RATES[idx]);
        setCurrentResult(newResult);
        setResults((prev) => {
          if (prev.find((r) => r.sampleRateMsps === newResult.sampleRateMsps)) return prev;
          return [...prev, newResult];
        });
        rateIdx = idx;
      }

      if (elapsed >= totalMs) {
        clearTimer();
        setRunning(false);
        setProgress(100);
        setCurrentResult(null);
      }
    }, 120);
  };

  const handleAbort = async () => {
    clearTimer();
    await stopApp();
    setRunning(false);
    setProgress(0);
    setCurrentResult(null);
  };

  useEffect(() => () => clearTimer(), [clearTimer]);

  const throughput = currentResult?.throughputMbps ?? (results.at(-1)?.throughputMbps ?? 0);
  const latency    = currentResult?.latencyMs ?? (results.at(-1)?.latencyMs ?? 0);
  const dropped    = currentResult?.droppedSamples ?? (results.at(-1)?.droppedSamples ?? 0);
  const sampleRate = currentResult?.sampleRateMsps ?? (results.at(-1)?.sampleRateMsps ?? 0);
  const passCount  = results.filter((r) => r.pass).length;

  const appStatus: AppStatus = running ? "live" : results.length > 0 ? "idle" : "idle";
  const statusText = running
    ? `Benchmarking · ${progress.toFixed(0)}%`
    : results.length > 0
    ? `${passCount}/${results.length} rates passed`
    : "Ready";

  return (
    <AppScreen
      appId="sdr_benchmark"
      title="SDR Benchmark"
      subtitle="Hardware Performance"
      status={appStatus}
      statusText={statusText}
      actions={
        running ? (
          <button className="bench-btn bench-btn--abort" onClick={handleAbort}>■ Abort</button>
        ) : (
          <button className="bench-btn bench-btn--run" onClick={handleRun}>▶ Run</button>
        )
      }
      controls={
        <div className="bench-controls">
          <div className="bench-ctrl-field">
            <label className="bench-ctrl-label">Center Frequency</label>
            <input
              className="bench-ctrl-input"
              type="number"
              value={centerHz}
              step={10_000_000}
              onChange={(e) => setCenterHz(Number(e.target.value))}
            />
          </div>
          <div className="bench-ctrl-field">
            <label className="bench-ctrl-label">Duration (s)</label>
            <input
              className="bench-ctrl-input bench-ctrl-input--sm"
              type="number"
              value={durationS}
              min={2}
              max={60}
              onChange={(e) => setDurationS(Math.max(2, Number(e.target.value)))}
            />
          </div>
          <div className="bench-ctrl-summary">
            {SAMPLE_RATES.length} rates · {fmtHz(centerHz)}
          </div>
        </div>
      }
      footer={<RecordBar appId={"sdr_benchmark" as AppId} format="iq" centerHz={centerHz} />}
    >
      <div className="bench-layout">
        {/* Gauge + stats row */}
        <div className="bench-hero-row">
          {/* Throughput gauge — the hero */}
          <GlassPanel title="Throughput" pad="md" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 160 }}>
            <div className="bench-gauge-wrap">
              <Gauge
                label="Throughput"
                value={throughput}
                min={0}
                max={400}
                unit="Mbit/s"
                size={160}
                showValue
              />
            </div>
          </GlassPanel>

          {/* Stat readouts */}
          <div className="bench-stats">
            <StatReadout
              label="Sample Rate"
              value={sampleRate || null}
              unit="Msps"
              size="md"
              digits={0}
            />
            <StatReadout
              label="Throughput"
              value={throughput || null}
              unit="Mbit/s"
              size="md"
              digits={0}
            />
            <StatReadout
              label="Dropped"
              value={dropped || null}
              unit="samp"
              size="md"
              digits={0}
            />
            <StatReadout
              label="Latency"
              value={latency || null}
              unit="ms"
              size="md"
              digits={1}
            />
          </div>
        </div>

        {/* Progress bar */}
        {(running || progress > 0) && (
          <div className="bench-progress-wrap">
            <div className="bench-progress__label">
              <span className="bench-progress__text">
                {running ? `Testing ${currentResult?.sampleRateMsps ?? "…"} Msps…` : "Complete"}
              </span>
              <span className="bench-progress__pct">{progress.toFixed(0)}%</span>
            </div>
            <div className="bench-progress">
              <div className="bench-progress__fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Spectrum strip */}
        <GlassPanel title="Live Spectrum" pad="none" style={{ flexShrink: 0 }}>
          <div className="bench-spectrum">
            <SpectrumStrip frame={spectrum} running={running} />
          </div>
        </GlassPanel>

        {/* Results table */}
        <GlassPanel
          title="Benchmark Results"
          titleRight={
            results.length > 0 ? (
              <span className="bench-score">
                {passCount}/{results.length} pass
              </span>
            ) : undefined
          }
        >
          <ResultsTable results={results} />
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
