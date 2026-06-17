import { useEffect, useRef, useState, useCallback } from "react";
import { listApps, listUsbDevices, listRecordings, startApp, stopApp, type UsbDevice } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { AppStatus } from "../../ipc/types/AppStatus";
import type { AppMetadata } from "../../ipc/types/AppMetadata";
import type { RecordingMeta } from "../../ipc/types/RecordingMeta";
import { Icon } from "../../components/kit/Icon";
import "./Dashboard.css";

/* ── GNU Radio waterfall colormap (shared with Waterfall.tsx) ── */
function colormap(v: number): [number, number, number] {
  const t = v / 255;
  if (t < 0.15) { const s = t / 0.15; return [0, 0, Math.floor(80 * s)]; }
  if (t < 0.35) { const s = (t - 0.15) / 0.2; return [0, Math.floor(255 * s), Math.floor(80 + 175 * s)]; }
  if (t < 0.5)  { const s = (t - 0.35) / 0.15; return [0, 255, Math.floor(255 * (1 - s))]; }
  if (t < 0.65) { const s = (t - 0.5) / 0.15; return [Math.floor(255 * s), 255, 0]; }
  if (t < 0.85) { const s = (t - 0.65) / 0.2; return [255, Math.floor(255 * (1 - s)), 0]; }
  const s = (t - 0.85) / 0.15; return [255, Math.floor(255 * s), Math.floor(255 * s)];
}

function fmtHz(hz: number): string {
  if (hz >= 1e9) return (hz / 1e9).toFixed(4) + " GHz";
  if (hz >= 1e6) return (hz / 1e6).toFixed(4) + " MHz";
  if (hz >= 1e3) return (hz / 1e3).toFixed(2) + " kHz";
  return hz.toFixed(0) + " Hz";
}

function fmtBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " KB";
  return n + " B";
}

/* ── Quick-launch tile definitions with sensible default params ── */
interface QuickApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  params: unknown;
}

const QUICK_APPS: QuickApp[] = [
  { id: "nfm_audio", name: "NFM",      icon: "radio",     color: "#3b82f6", params: { center_hz: 146_520_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, squelch_db: -60 } },
  { id: "wfm_rx",    name: "WFM",      icon: "broadcast", color: "#6366f1", params: { center_hz: 99_100_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, stereo: true } },
  { id: "am_rx",     name: "AM",       icon: "radio",     color: "#8b5cf6", params: { center_hz: 118_000_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, bandwidth_hz: 8000 } },
  { id: "usb_rx",    name: "USB",      icon: "radio",     color: "#a855f7", params: { center_hz: 14_200_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, bfo_hz: -1500, bandwidth_hz: 2400, sideband: "usb" } },
  { id: "lsb_rx",    name: "LSB",      icon: "radio",     color: "#a855f7", params: { center_hz: 7_100_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, bfo_hz: 1500, bandwidth_hz: 2400, sideband: "lsb" } },
  { id: "cw_rx",     name: "CW",       icon: "bolt",      color: "#eab308", params: { center_hz: 14_000_000, lna_gain_db: 24, vga_gain_db: 30, amp_enabled: false, bfo_hz: 600, bandwidth_hz: 400, sideband: "usb" } },
  { id: "adsb_rx",   name: "ADS-B",    icon: "airplane",  color: "#10b981", params: { lna_gain_db: 40, vga_gain_db: 40 } },
];

interface DashboardProps {
  onSelectApp: (id: string) => void;
  onBrowseAll: () => void;
}

export function DashboardApp({ onSelectApp, onBrowseAll }: DashboardProps) {
  const [apps, setApps] = useState<AppMetadata[]>([]);
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [status, setStatus] = useState<AppStatus>({ kind: "idle" });
  const [frame, setFrame] = useState<SpectrumFrame | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [clock, setClock] = useState(new Date());
  const [launching, setLaunching] = useState<string | null>(null);
  const audioDecay = useRef<number>(0);

  /* One-time loads */
  useEffect(() => { listApps().then(setApps); }, []);
  useEffect(() => { listRecordings().then(setRecordings).catch(() => {}); }, []);

  /* USB poll every 3s */
  useEffect(() => {
    const poll = () => listUsbDevices().then(setUsbDevices).catch(() => {});
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  /* Live event subscriptions */
  useEffect(() => {
    const p1 = onSpectrum((f) => setFrame(f));
    const p2 = onAppStatus((s) => setStatus(s));
    const p3 = onAudio((a: AudioFrame) => {
      let sum = 0;
      for (let i = 0; i < a.samples.length; i++) sum += a.samples[i] * a.samples[i];
      const rms = Math.sqrt(sum / Math.max(1, a.samples.length));
      const db = 20 * Math.log10(Math.max(1, rms));
      const level = Math.max(0, Math.min(1, (db + 60) / 60));
      setAudioLevel(level);
      audioDecay.current = level;
    });
    /* audio level decay when no frames arrive */
    const decayIv = setInterval(() => {
      audioDecay.current = Math.max(0, audioDecay.current * 0.88);
      setAudioLevel(audioDecay.current);
    }, 50);
    return () => {
      p1.then((f) => f());
      p2.then((f) => f());
      p3.then((f) => f());
      clearInterval(decayIv);
    };
  }, []);

  /* Clock tick */
  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const hackrf = usbDevices.find((d) => d.is_hackrf);
  const isRunning = status.kind === "running" || status.kind === "starting";
  const runningAppId = status.kind === "running" || status.kind === "starting" ? status.app : null;
  const totalRecSize = recordings.reduce((s, r) => s + r.size_bytes, 0);

  const handleQuickLaunch = useCallback(async (app: QuickApp) => {
    setLaunching(app.id);
    try { await startApp(app.id as never, app.params); }
    catch (e) { console.warn("launch failed", e); }
    finally { setLaunching(null); }
  }, []);

  const handleStop = useCallback(async () => {
    try { await stopApp(); setFrame(null); } catch (e) { console.warn(e); }
  }, []);

  const statusLabel = status.kind === "idle" ? "Idle"
    : status.kind === "starting" ? "Starting"
    : status.kind === "running" ? "Live"
    : status.kind === "stopping" ? "Stopping"
    : "Error";

  return (
    <div className="dash">
      {/* ── Hero status strip ── */}
      <div className="dash-hero">
        <div className="dash-hero-left">
          <span className="dash-clock-time">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className="dash-clock-date">{clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
        <div className="dash-hero-right">
          <div className={`dash-hackrf-pill ${hackrf ? "connected" : "disconnected"}`}>
            <span className="dash-hackrf-dot" />
            <Icon name="antenna" size={14} />
            <span>{hackrf ? "HackRF Connected" : "No HackRF"}</span>
          </div>
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div className="dash-grid">
        {/* Live spectrum — hero panel */}
        <div className="dash-cell dash-cell--spectrum">
          <div className="dash-cell-head">
            <span className="dash-cell-title"><Icon name="waveform" size={14} /> Live Spectrum</span>
            {frame && (
              <span className="dash-cell-meta">
                {fmtHz(frame.center_hz)} · span {fmtHz(frame.span_hz)}
              </span>
            )}
          </div>
          <MiniWaterfall frame={frame} active={isRunning} />
          {!isRunning && (
            <div className="dash-spectrum-empty">
              <Icon name="antenna" size={36} />
              <span>Launch an app to see live RF</span>
              <span className="dash-spectrum-empty-sub">Quick-launch below — spectrum & audio stream here instantly</span>
            </div>
          )}
        </div>

        {/* Active app panel */}
        <div className="dash-cell dash-cell--active">
          <div className="dash-cell-head">
            <span className="dash-cell-title"><Icon name="bolt" size={14} /> Active App</span>
            <span className={`dash-status-tag dash-status-tag--${status.kind}`}>{statusLabel}</span>
          </div>
          {runningAppId ? (
            <div className="dash-active-body">
              <div className="dash-active-name">{runningAppId.replace(/_/g, " ")}</div>
              <div className="dash-audio-meter">
                <span className="dash-audio-label"><Icon name="volumeUp" size={12} /> Audio</span>
                <div className="dash-audio-bar">
                  <div className="dash-audio-fill" style={{ width: `${audioLevel * 100}%` }} />
                </div>
                <span className="dash-audio-db">{Math.round(audioLevel * 60 - 60)} dB</span>
              </div>
              <div className="dash-active-actions">
                <button className="dash-btn dash-btn--primary" onClick={() => onSelectApp(runningAppId)}>
                  <Icon name="arrowLeft" size={13} /> Open Full View
                </button>
                <button className="dash-btn dash-btn--danger" onClick={handleStop}>
                  <Icon name="close" size={13} /> Stop
                </button>
              </div>
            </div>
          ) : (
            <div className="dash-active-empty">
              <Icon name="radio" size={28} />
              <span>No app running</span>
              <span className="dash-active-empty-sub">Tap a tile below to start</span>
            </div>
          )}
        </div>

        {/* Stats panel */}
        <div className="dash-cell dash-cell--stats">
          <div className="dash-cell-head">
            <span className="dash-cell-title"><Icon name="satellite" size={14} /> System</span>
          </div>
          <div className="dash-stats-grid">
            <div className="dash-stat">
              <span className="dash-stat-value">{apps.length}</span>
              <span className="dash-stat-label">Apps</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-value">{usbDevices.length}</span>
              <span className="dash-stat-label">USB Devices</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-value">{recordings.length}</span>
              <span className="dash-stat-label">Recordings</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-value">{fmtBytes(totalRecSize)}</span>
              <span className="dash-stat-label">Disk Used</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick launch rail ── */}
      <div className="dash-launch">
        <div className="dash-launch-head">
          <span className="dash-cell-title"><Icon name="bolt" size={14} /> Quick Launch</span>
          <button className="dash-browse-all" onClick={onBrowseAll}>
            Browse all apps <Icon name="chevronDown" size={13} />
          </button>
        </div>
        <div className="dash-launch-rail">
          {QUICK_APPS.map((app) => {
            const isActive = runningAppId === app.id;
            const isLaunching = launching === app.id;
            return (
              <button
                key={app.id}
                className={`dash-tile${isActive ? " dash-tile--active" : ""}`}
                onClick={() => isActive ? handleStop() : handleQuickLaunch(app)}
                style={{ "--tile-color": app.color } as React.CSSProperties}
                disabled={isLaunching}
              >
                <span className="dash-tile-icon"><Icon name={app.icon} size={22} /></span>
                <span className="dash-tile-name">{app.name}</span>
                <span className="dash-tile-state">
                  {isLaunching ? "…" : isActive ? "ON" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Lightweight mini-waterfall (read-only, no interaction) ── */
function MiniWaterfall({ frame, active }: { frame: SpectrumFrame | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(-1);
  const [w, setW] = useState(480);
  const H = 180;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(200, el.clientWidth));
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    if (frame.seq === lastSeq.current) return;
    lastSeq.current = frame.seq;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = ctx.getImageData(0, 1, w, H - 1);
    ctx.putImageData(img, 0, 0);
    const row = ctx.createImageData(w, 1);
    const bins = frame.bins;
    for (let x = 0; x < w; x++) {
      const binIdx = Math.min(bins.length - 1, Math.floor((x / w) * bins.length));
      const v = bins[binIdx] ?? 0;
      const [r, g, b] = colormap(v);
      const idx = x * 4;
      row.data[idx] = r;
      row.data[idx + 1] = g;
      row.data[idx + 2] = b;
      row.data[idx + 3] = 255;
    }
    ctx.putImageData(row, 0, H - 1);
  }, [frame, w]);

  if (!active) return <div className="dash-mini-waterfall dash-mini-waterfall--idle" ref={containerRef} />;

  return (
    <div className="dash-mini-waterfall" ref={containerRef}>
      <canvas ref={canvasRef} width={w} height={H} style={{ width: "100%", height: H }} />
    </div>
  );
}
