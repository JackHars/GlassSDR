import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { Icon } from "../../components/kit/Icon";
import { StatReadout } from "../../components/kit/StatReadout";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./RfChar.css";

interface TxStatusPayload {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

function fmtHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

// ── Sweep ruler SVG ───────────────────────────────────────────────────────────

interface SweepRulerProps {
  startHz: number;
  stopHz: number;
  progressPct: number | null;
  running: boolean;
}

function SweepRuler({ startHz, stopHz, progressPct, running }: SweepRulerProps) {
  const spanHz = stopHz - startHz;
  const points = spanHz > 0 ? Math.ceil(spanHz / 1e6) : 0;
  // Tick marks: try 5 evenly-spaced ticks
  const tickCount = 5;
  const pct = progressPct ?? 0;

  return (
    <div className="rfchar-ruler">
      <svg className="rfchar-ruler__svg" viewBox="0 0 600 64" preserveAspectRatio="none">
        {/* Background */}
        <rect width="600" height="64" fill="rgba(10,20,18,0.88)" rx="6" />

        {/* Grid lines */}
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const x = (i / tickCount) * 600;
          return (
            <line key={i} x1={x} y1="8" x2={x} y2="48" stroke="rgba(82,168,132,0.15)" strokeWidth="0.75" />
          );
        })}

        {/* Frequency axis labels */}
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const x = (i / tickCount) * 600;
          const hz = startHz + (i / tickCount) * spanHz;
          return (
            <text
              key={i}
              x={x}
              y="61"
              fill="rgba(82,168,132,0.55)"
              fontSize="8"
              fontFamily="SF Mono, JetBrains Mono, monospace"
              textAnchor="middle"
            >
              {fmtHz(hz)}
            </text>
          );
        })}

        {/* Scanned region fill */}
        {running && pct > 0 && (
          <rect
            x="0"
            y="8"
            width={`${pct}%`}
            height="40"
            fill="rgba(82,168,132,0.10)"
          />
        )}

        {/* Ruler ticks along top */}
        {Array.from({ length: 21 }, (_, i) => {
          const x = (i / 20) * 600;
          const major = i % 4 === 0;
          return (
            <line
              key={i}
              x1={x} y1="8"
              x2={x} y2={major ? "20" : "16"}
              stroke={major ? "rgba(82,168,132,0.5)" : "rgba(82,168,132,0.25)"}
              strokeWidth={major ? "1" : "0.5"}
            />
          );
        })}

        {/* Baseline */}
        <line x1="0" y1="8" x2="600" y2="8" stroke="rgba(82,168,132,0.35)" strokeWidth="1" />
        <line x1="0" y1="48" x2="600" y2="48" stroke="rgba(82,168,132,0.18)" strokeWidth="0.5" />

        {/* Sweep playhead */}
        {running && (
          <>
            <line
              x1={`${pct}%`} y1="6"
              x2={`${pct}%`} y2="50"
              stroke="#52A884"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <polygon
              points={`${pct * 6},4 ${pct * 6 - 5},0 ${pct * 6 + 5},0`}
              fill="#52A884"
            />
          </>
        )}

        {/* Idle: center annotation */}
        {!running && (
          <text
            x="300"
            y="34"
            fill="rgba(82,168,132,0.4)"
            fontSize="11"
            fontFamily="SF Mono, JetBrains Mono, monospace"
            textAnchor="middle"
            fontStyle="italic"
          >
            {spanHz > 0
              ? `${fmtHz(startHz)} – ${fmtHz(stopHz)} · ${points} steps`
              : "configure range above"}
          </text>
        )}
      </svg>

      {running && pct > 0 && (
        <div className="rfchar-ruler__progress-label">
          {pct.toFixed(0)}% · {fmtHz(startHz + (pct / 100) * spanHz)}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RfCharApp() {
  const [startHz, setStartHz] = useState(88_000_000);
  const [stopHz, setStopHz]   = useState(108_000_000);
  const [stepHz, setStepHz]   = useState(1_000_000);
  const [running, setRunning] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatusPayload | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatusPayload>("tx_status", (e) => {
      setTxStatus(e.payload);
      if (e.payload.kind === "idle" || e.payload.kind === "complete") {
        setRunning(false);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("rf_characterize" as AppId, {
      start_hz: startHz,
      stop_hz: stopHz,
      step_hz: stepHz,
    });
    setRunning(true);
  };

  const handleStop = async () => {
    await stopApp();
    setRunning(false);
  };

  const spanHz = stopHz - startHz;
  const numPoints = spanHz > 0 ? Math.ceil(spanHz / stepHz) : 0;

  const appStatus: AppStatus = running ? "live" : "idle";
  const statusText = running
    ? `Sweeping · ${txStatus?.progress_pct?.toFixed(0) ?? 0}%`
    : `Ready · ${numPoints.toLocaleString()} points`;

  return (
    <AppScreen
      appId="rf_characterize"
      title="RF Characterization"
      subtitle="Measurement Suite"
      status={appStatus}
      statusText={statusText}
      actions={
        running ? (
          <button className="rfchar-btn rfchar-btn--stop" onClick={handleStop}>■ Stop</button>
        ) : (
          <button className="rfchar-btn rfchar-btn--start" onClick={handleStart} disabled={spanHz <= 0}>
            ▶ Sweep
          </button>
        )
      }
      controls={
        <div className="rfchar-controls">
          <div className="rfchar-ctrl-field">
            <label className="rfchar-ctrl-label">Start</label>
            <input
              className="rfchar-ctrl-input"
              type="number"
              value={startHz}
              step={1_000_000}
              onChange={(e) => setStartHz(Number(e.target.value))}
            />
          </div>
          <div className="rfchar-ctrl-field">
            <label className="rfchar-ctrl-label">Stop</label>
            <input
              className="rfchar-ctrl-input"
              type="number"
              value={stopHz}
              step={1_000_000}
              onChange={(e) => setStopHz(Number(e.target.value))}
            />
          </div>
          <div className="rfchar-ctrl-field">
            <label className="rfchar-ctrl-label">Step</label>
            <input
              className="rfchar-ctrl-input rfchar-ctrl-input--sm"
              type="number"
              value={stepHz}
              step={100_000}
              onChange={(e) => setStepHz(Number(e.target.value))}
            />
          </div>
          <div className="rfchar-ctrl-summary">
            <span className="rfchar-ctrl-summary__val">
              {fmtHz(spanHz)} span · {numPoints.toLocaleString()} pts
            </span>
          </div>
        </div>
      }
      footer={<RecordBar appId={"rf_characterize" as AppId} format="iq" centerHz={Math.round((startHz + stopHz) / 2)} />}
    >
      <div className="rfchar-layout">
        {/* Indoor-test banner */}
        <div className="rfchar-banner">
          <span className="rfchar-banner__icon"><Icon name="warning" size={16} /></span>
          <span>
            <strong>INDOOR TEST ONLY</strong> — intentional transmissions; operate only inside a shielded enclosure.
          </span>
        </div>

        {/* Sweep ruler — hero visual */}
        <GlassPanel title="Sweep Range" pad="none" size="fill" style={{ minHeight: 100 }}>
          <SweepRuler
            startHz={startHz}
            stopHz={stopHz}
            progressPct={running ? (txStatus?.progress_pct ?? 0) : null}
            running={running}
          />
        </GlassPanel>

        {/* Measurement report card — the 4 StatReadouts */}
        <GlassPanel title="Measurement Report" titleRight={
          <span className="rfchar-report-badge">
            {running ? "live" : "idle"}
          </span>
        }>
          <div className="rfchar-stat-grid">
            <StatReadout
              label="Bandwidth"
              value={null}
              unit="MHz"
              size="md"
              digits={3}
            />
            <StatReadout
              label="Modulation"
              value={null}
              size="md"
              mono={false}
            />
            <StatReadout
              label="Symbol Rate"
              value={null}
              unit="Bd"
              size="md"
              digits={0}
            />
            <StatReadout
              label="Deviation"
              value={null}
              unit="kHz"
              size="md"
              digits={2}
            />
          </div>
          <div className="rfchar-report-note">
            Measurement values populate after a completed sweep.
          </div>
        </GlassPanel>

        {/* Sweep configuration summary */}
        <GlassPanel title="Configuration">
          <div className="rfchar-config-grid">
            <div className="rfchar-config-row">
              <span className="rfchar-config-label">Start frequency</span>
              <span className="rfchar-config-val">{fmtHz(startHz)}</span>
            </div>
            <div className="rfchar-config-row">
              <span className="rfchar-config-label">Stop frequency</span>
              <span className="rfchar-config-val">{fmtHz(stopHz)}</span>
            </div>
            <div className="rfchar-config-row">
              <span className="rfchar-config-label">Step size</span>
              <span className="rfchar-config-val">{fmtHz(stepHz)}</span>
            </div>
            <div className="rfchar-config-row">
              <span className="rfchar-config-label">Measurement points</span>
              <span className="rfchar-config-val">{numPoints.toLocaleString()}</span>
            </div>
            {txStatus && (
              <div className="rfchar-config-row">
                <span className="rfchar-config-label">Status</span>
                <span className="rfchar-config-val rfchar-config-val--status">
                  {txStatus.kind}
                  {txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct.toFixed(0)}%` : ""}
                  {txStatus.message ? ` — ${txStatus.message}` : ""}
                </span>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
