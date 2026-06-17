import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./LookingGlass.css";

// Log-scale mapping: 1 MHz to 6000 MHz
const MIN_MHZ = 1;
const MAX_MHZ = 6000;
const LOG_MIN = Math.log10(MIN_MHZ);
const LOG_MAX = Math.log10(MAX_MHZ);

function mhzToX(mhz: number, w: number): number {
  const t = (Math.log10(Math.max(MIN_MHZ, mhz)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return t * w;
}

// Named band annotations
const BANDS = [
  { label: "AM",    mhz: 1.0,    end: 1.6 },
  { label: "FM",    mhz: 88,     end: 108  },
  { label: "Air",   mhz: 108,    end: 137  },
  { label: "Marine",mhz: 156,    end: 174  },
  { label: "UHF",   mhz: 430,    end: 470  },
  { label: "900",   mhz: 880,    end: 960  },
  { label: "GPS",   mhz: 1565,   end: 1585 },
  { label: "1.8G",  mhz: 1710,   end: 1880 },
  { label: "2.4G",  mhz: 2400,   end: 2484 },
  { label: "5.8G",  mhz: 5725,   end: 5875 },
];

// Axis tick marks (MHz)
const AXIS_TICKS = [1, 10, 30, 100, 300, 500, 1000, 2000, 3000, 5000];

function dbToHeight(db: number): number {
  return Math.max(0.02, Math.min(1.0, (db + 110) / 80));
}

function dbToColor(db: number): string {
  if (db > -50) return "rgba(64,200,120,0.85)";
  if (db > -70) return "rgba(64,140,220,0.65)";
  return "rgba(64,96,176,0.35)";
}

interface PeakEntry {
  freq_hz: number;
  power_db: number;
}

function PanoramicSpectrum({ hits }: { hits: Map<number, number> }) {
  const W = 680;
  const H = 96;
  const AXIS_Y = H - 16;
  const BAND_Y = 6;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="lg-tx__pano-svg"
      aria-label="Panoramic spectrum view 1 MHz – 6 GHz"
      preserveAspectRatio="none"
    >
      {/* Background */}
      <rect x={0} y={0} width={W} height={AXIS_Y} fill="rgba(6,8,20,0.60)" />

      {/* Band shading */}
      {BANDS.map((b) => {
        const x1 = mhzToX(b.mhz, W);
        const x2 = mhzToX(b.end, W);
        const bw = Math.max(x2 - x1, 2);
        return (
          <g key={b.label}>
            <rect x={x1} y={BAND_Y} width={bw} height={AXIS_Y - BAND_Y - 2}
              fill="rgba(64,96,176,0.08)" />
            <text x={x1 + bw / 2} y={BAND_Y + 7}
              className="lg-tx__band-label" textAnchor="middle">
              {b.label}
            </text>
          </g>
        );
      })}

      {/* Axis line */}
      <line x1={0} y1={AXIS_Y} x2={W} y2={AXIS_Y}
        stroke="rgba(64,96,176,0.30)" strokeWidth={0.8} />

      {/* Axis ticks */}
      {AXIS_TICKS.map((mhz) => {
        const x = mhzToX(mhz, W);
        const label = mhz >= 1000 ? `${mhz / 1000}G` : `${mhz}`;
        return (
          <g key={mhz}>
            <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 3}
              stroke="rgba(64,96,176,0.40)" strokeWidth={0.6} />
            <text x={x} y={H - 2}
              className="lg-tx__axis-label" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}

      {/* Signal bars */}
      {[...hits.entries()].map(([hz, db]) => {
        const mhz = hz / 1e6;
        const x = mhzToX(mhz, W);
        const barH = dbToHeight(db) * (AXIS_Y - BAND_Y - 6);
        return (
          <rect
            key={hz}
            x={x - 0.8} y={AXIS_Y - barH}
            width={1.6} height={barH}
            fill={dbToColor(db)}
            rx={0.4}
          />
        );
      })}

      {/* "PANORAMA" watermark */}
      <text x={W / 2} y={AXIS_Y / 2 + 10}
        className="lg-tx__panorama-mark" textAnchor="middle">
        PANORAMA
      </text>
    </svg>
  );
}

export function LookingGlassApp() {
  const [running, setRunning] = useState(false);
  const [hitCount, setHitCount] = useState(0);
  const [peaks, setPeaks] = useState<PeakEntry[]>([]);

  // Use ref for the hit map to avoid re-renders on every event
  const hitMapRef = useRef<Map<number, number>>(new Map());
  const [hitMapVersion, setHitMapVersion] = useState(0);

  useEffect(() => {
    const p = listen<{ freq_hz: number; power_db: number }>("scan_result", (e) => {
      const { freq_hz, power_db } = e.payload;
      const existing = hitMapRef.current.get(freq_hz) ?? -120;
      if (power_db > existing) {
        hitMapRef.current.set(freq_hz, power_db);
        setHitCount(hitMapRef.current.size);
        // Throttle re-renders: bump version every ~50 new hits
        if (hitMapRef.current.size % 50 === 0) {
          setHitMapVersion((v) => v + 1);
          const sorted = [...hitMapRef.current.entries()]
            .filter(([, db]) => db > -80)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 60)
            .map(([hz, db]) => ({ freq_hz: hz, power_db: db }));
          setPeaks(sorted);
        }
      }
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    hitMapRef.current.clear();
    setHitCount(0);
    setPeaks([]);
    setHitMapVersion(0);
    await startApp("looking_glass" as AppId, {
      start_hz: 1_000_000,
      stop_hz: 6_000_000_000,
      step_hz: 1_000_000,
      lna_gain_db: 32,
      vga_gain_db: 20,
      amp_enabled: false,
    });
    setRunning(true);
  }, []);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
    // Final peak refresh
    const sorted = [...hitMapRef.current.entries()]
      .filter(([, db]) => db > -80)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([hz, db]) => ({ freq_hz: hz, power_db: db }));
    setPeaks(sorted);
    setHitMapVersion((v) => v + 1);
  }, []);

  const fmtFreq = (hz: number) => {
    if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
    return `${(hz / 1e6).toFixed(3)} MHz`;
  };

  return (
    <AppScreen
      appId="looking_glass"
      title="Looking Glass"
      subtitle="1 MHz – 6 GHz panorama"
      status={running ? "live" : hitCount > 0 ? "empty" : "idle"}
      statusText={running ? `Sweeping · ${hitCount.toLocaleString()} bins` : hitCount > 0 ? `${hitCount.toLocaleString()} bins captured` : "Idle"}
      actions={
        <div className="lg-tx__header-actions">
          <button
            className={`lg-tx__ctrl-btn lg-tx__ctrl-btn--start${running ? " lg-tx__ctrl-btn--off" : ""}`}
            onClick={handleStart} disabled={running}
          >▶ Start</button>
          <button
            className={`lg-tx__ctrl-btn lg-tx__ctrl-btn--stop${!running ? " lg-tx__ctrl-btn--off" : ""}`}
            onClick={handleStop} disabled={!running}
          >■ Stop</button>
          <button
            className="lg-tx__ctrl-btn lg-tx__ctrl-btn--clear"
            onClick={() => {
              hitMapRef.current.clear();
              setHitCount(0);
              setPeaks([]);
              setHitMapVersion(0);
            }}
          >Clear</button>
        </div>
      }
    >
      {/* Panoramic spectrum hero — full-bleed */}
      <GlassPanel
        title={`Panoramic Spectrum (log scale) · ${hitCount.toLocaleString()} bins`}
        size="fill"
        pad="sm"
        className="lg-tx__pano-panel"
      >
        <PanoramicSpectrum
          key={hitMapVersion}
          hits={hitMapRef.current}
        />
        <div className="lg-tx__scale-note">
          Logarithmic frequency axis · 1 MHz → 6 GHz · HackRF full range
        </div>
      </GlassPanel>

      {/* Peak signals */}
      <GlassPanel
        title={`Peak Signals above −80 dB · ${peaks.length}`}
        size="fill"
        pad="none"
        className="lg-tx__peaks-panel"
      >
        {peaks.length === 0 ? (
          <div className="lg-tx__empty">
            {running ? "Sweeping — no peaks above −80 dB yet…" : "Press ▶ Start to begin the wide-band panoramic sweep"}
          </div>
        ) : (
          <div className="lg-tx__peaks-list">
            <div className="lg-tx__peaks-hdr">
              <span>Frequency</span>
              <span>Power</span>
              <span>Band</span>
              <span className="lg-tx__hdr-bar">Level</span>
            </div>
            {peaks.map((p, i) => {
              const mhz = p.freq_hz / 1e6;
              const band = BANDS.find((b) => mhz >= b.mhz && mhz <= b.end);
              const pct = Math.max(0, Math.min(100, ((p.power_db + 100) / 60) * 100));
              return (
                <div key={i} className="lg-tx__peak-row">
                  <span className="lg-tx__peak-freq">{fmtFreq(p.freq_hz)}</span>
                  <span className={`lg-tx__peak-pwr${p.power_db > -60 ? " lg-tx__peak-pwr--strong" : ""}`}>
                    {p.power_db.toFixed(1)} dB
                  </span>
                  <span className="lg-tx__peak-band">{band?.label ?? "—"}</span>
                  <div className="lg-tx__peak-bar-wrap">
                    <div className="lg-tx__peak-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"looking_glass" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
      />
    </AppScreen>
  );
}
