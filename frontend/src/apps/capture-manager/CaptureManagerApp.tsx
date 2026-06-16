import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp, listRecordings, deleteRecording } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import type { RecordingMeta } from "../../ipc/types/RecordingMeta";
import "./CaptureManager.css";

interface TxStatusPayload {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

function fmtFreq(hz: number | null): string {
  if (hz === null || hz === 0) return "—";
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(4)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

function fmtTimestamp(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

// Log-scale frequency position 0–100% across 0.1 MHz → 6 GHz
function freqPct(hz: number | null): number {
  if (!hz || hz <= 0) return 0;
  const mhz = hz / 1e6;
  const logMin = Math.log10(0.1);
  const logMax = Math.log10(6000);
  return Math.max(2, Math.min(98, ((Math.log10(Math.max(0.1, mhz)) - logMin) / (logMax - logMin)) * 100));
}

function bandLabel(hz: number | null): string {
  if (!hz) return "—";
  const mhz = hz / 1e6;
  if (mhz < 3) return "LF/MF";
  if (mhz < 30) return "HF";
  if (mhz < 300) return "VHF";
  if (mhz < 1000) return "UHF";
  if (mhz < 3000) return "L/S";
  return "C/X";
}

// ── Spectrum Thumbnail ────────────────────────────────────────────────────────

interface SpectrumThumbProps {
  centerHz: number | null;
}

function SpectrumThumb({ centerHz }: SpectrumThumbProps) {
  const pct = freqPct(centerHz);
  const band = bandLabel(centerHz);
  const freqStr = fmtFreq(centerHz);

  return (
    <div className="cm-thumb">
      <svg className="cm-thumb__svg" viewBox="0 0 280 44" preserveAspectRatio="none">
        {/* Background */}
        <rect width="280" height="44" fill="rgba(14,8,36,0.90)" />

        {/* Subtle band zones (log scale approximate positions) */}
        {/* HF: ~0–30MHz → ~0%–43% */}
        <rect x="0" y="0" width="120" height="44" fill="rgba(60,40,120,0.18)" />
        {/* VHF: 30–300MHz → ~43%–65% */}
        <rect x="120" y="0" width="62" height="44" fill="rgba(50,80,160,0.16)" />
        {/* UHF: 300MHz–1GHz → ~65%–86% */}
        <rect x="182" y="0" width="59" height="44" fill="rgba(80,50,160,0.18)" />
        {/* SHF: 1–6GHz → ~86%–100% */}
        <rect x="241" y="0" width="39" height="44" fill="rgba(100,40,150,0.16)" />

        {/* Band divider ticks */}
        <line x1="120" y1="0" x2="120" y2="44" stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />
        <line x1="182" y1="0" x2="182" y2="44" stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />
        <line x1="241" y1="0" x2="241" y2="44" stroke="rgba(139,92,246,0.15)" strokeWidth="0.5" />

        {/* Band labels */}
        <text x="4"   y="38" fill="rgba(139,92,246,0.45)" fontSize="8" fontFamily="SF Mono, JetBrains Mono, monospace">HF</text>
        <text x="124" y="38" fill="rgba(139,92,246,0.45)" fontSize="8" fontFamily="SF Mono, JetBrains Mono, monospace">VHF</text>
        <text x="186" y="38" fill="rgba(139,92,246,0.45)" fontSize="8" fontFamily="SF Mono, JetBrains Mono, monospace">UHF</text>
        <text x="245" y="38" fill="rgba(139,92,246,0.45)" fontSize="8" fontFamily="SF Mono, JetBrains Mono, monospace">SHF</text>

        {centerHz && (
          <>
            {/* Glow halo */}
            <rect
              x={`${pct - 3}%`} y="0"
              width="6%" height="44"
              fill="rgba(139,92,246,0.18)"
            />
            {/* Needle */}
            <line
              x1={`${pct}%`} y1="2"
              x2={`${pct}%`} y2="42"
              stroke="#8B5CF6"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top cap */}
            <circle cx={`${pct}%`} cy="4" r="2.5" fill="#8B5CF6" />
            {/* Frequency label above needle */}
            <text
              x={`${Math.min(Math.max(pct, 8), 88)}%`}
              y="15"
              fill="#C4B5FD"
              fontSize="7.5"
              fontFamily="SF Mono, JetBrains Mono, monospace"
              textAnchor="middle"
              fontWeight="600"
            >
              {freqStr}
            </text>
            {/* Band badge */}
            <text
              x={`${Math.min(Math.max(pct, 8), 88)}%`}
              y="25"
              fill="rgba(196,181,253,0.65)"
              fontSize="6.5"
              fontFamily="SF Mono, JetBrains Mono, monospace"
              textAnchor="middle"
            >
              {band}
            </text>
          </>
        )}

        {!centerHz && (
          <text x="140" y="26" fill="rgba(139,92,246,0.35)" fontSize="9" fontFamily="SF Mono, JetBrains Mono, monospace" textAnchor="middle">no frequency tagged</text>
        )}
      </svg>
    </div>
  );
}

// ── Capture Card ──────────────────────────────────────────────────────────────

interface CaptureCardProps {
  meta: RecordingMeta;
  onReplay: (meta: RecordingMeta) => void;
  onDelete: (path: string) => void;
  isReplaying: boolean;
}

function CaptureCard({ meta, onReplay, onDelete, isReplaying }: CaptureCardProps) {
  return (
    <div className={`cm-card${isReplaying ? " cm-card--replaying" : ""}`}>
      <SpectrumThumb centerHz={meta.center_hz} />

      <div className="cm-card__body">
        <div className="cm-card__freq">{fmtFreq(meta.center_hz)}</div>

        <div className="cm-card__meta">
          <div className="cm-card__meta-row">
            <span className="cm-card__meta-label">DATE</span>
            <span className="cm-card__meta-val">{fmtTimestamp(meta.started_unix_ms)}</span>
          </div>
          <div className="cm-card__meta-row">
            <span className="cm-card__meta-label">DUR</span>
            <span className="cm-card__meta-val">{fmtDuration(meta.duration_ms)}</span>
          </div>
          <div className="cm-card__meta-row">
            <span className="cm-card__meta-label">SIZE</span>
            <span className="cm-card__meta-val">{fmtSize(meta.size_bytes)}</span>
          </div>
        </div>

        <div className="cm-card__filename" title={meta.path}>
          {fileName(meta.path)}
        </div>

        <div className="cm-card__actions">
          <button
            className={`cm-btn-replay${isReplaying ? " cm-btn-replay--active" : ""}`}
            onClick={() => onReplay(meta)}
            disabled={isReplaying}
          >
            {isReplaying ? "▶ Replaying…" : "▶ Replay"}
          </button>
          <button className="cm-btn-delete" onClick={() => onDelete(meta.path)}>
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type SortOrder = "newest" | "oldest" | "largest" | "freq";

export function CaptureManagerApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [txStatus, setTxStatus] = useState<TxStatusPayload | null>(null);
  const [mode, setMode] = useState<"record" | "replay" | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const refresh = useCallback(() => {
    listRecordings()
      .then((all) => setRecordings(all.filter((r) => r.format === "iq")))
      .catch(() => setRecordings([]));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const unlisten = listen<TxStatusPayload>("tx_status", (e) => {
      setTxStatus(e.payload);
      if (e.payload.kind === "idle" || e.payload.kind === "complete") {
        setMode(null);
        setReplayingId(null);
        refresh();
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, [refresh]);

  const handleRecord = async () => {
    setMode("record");
    await startApp("capture_manager" as AppId, {
      mode: "record",
      center_hz: freqHz,
      threshold_db: thresholdDb,
      lna_gain_db: 40,
      vga_gain_db: 20,
    });
  };

  const handleReplay = async (meta: RecordingMeta) => {
    if (!legalAccepted) { setShowLegal(true); return; }
    setMode("replay");
    setReplayingId(meta.id);
    await startApp("capture_manager" as AppId, {
      mode: "replay",
      center_hz: meta.center_hz ?? freqHz,
      threshold_db: thresholdDb,
      lna_gain_db: 40,
      vga_gain_db: 20,
    });
  };

  const handleStop = async () => {
    await stopApp();
    setMode(null);
    setReplayingId(null);
  };

  const handleDelete = async (path: string) => {
    await deleteRecording(path);
    refresh();
  };

  const sorted = [...recordings].sort((a, b) => {
    switch (sortOrder) {
      case "newest":  return b.started_unix_ms - a.started_unix_ms;
      case "oldest":  return a.started_unix_ms - b.started_unix_ms;
      case "largest": return b.size_bytes - a.size_bytes;
      case "freq":    return (a.center_hz ?? 0) - (b.center_hz ?? 0);
    }
  });

  const totalSize = recordings.reduce((acc, r) => acc + r.size_bytes, 0);

  const appStatus: AppStatus =
    mode === "record"
      ? "live"
      : mode === "replay"
      ? "acquiring"
      : "idle";

  const statusText =
    mode === "record"
      ? `Recording · trig ${thresholdDb} dBm`
      : mode === "replay"
      ? "Replaying capture"
      : `${recordings.length} IQ capture${recordings.length !== 1 ? "s" : ""} · ${fmtSize(totalSize)}`;

  return (
    <AppScreen
      appId="capture_manager"
      title="Capture Manager"
      subtitle="IQ Archive"
      status={appStatus}
      statusText={statusText}
      actions={
        mode ? (
          <button className="cm-action-stop" onClick={handleStop}>■ Stop</button>
        ) : (
          <button className="cm-action-record" onClick={handleRecord}>● Record</button>
        )
      }
      controls={
        <div className="cm-controls">
          <div className="cm-ctrl-field">
            <label className="cm-ctrl-label">Center Hz</label>
            <input
              className="cm-ctrl-input"
              type="number"
              value={freqHz}
              step={100_000}
              onChange={(e) => setFreqHz(Number(e.target.value))}
            />
          </div>
          <div className="cm-ctrl-field cm-ctrl-field--slider">
            <label className="cm-ctrl-label">Trigger {thresholdDb} dBm</label>
            <input
              className="cm-ctrl-slider"
              type="range"
              min={-80}
              max={0}
              value={thresholdDb}
              onChange={(e) => setThresholdDb(Number(e.target.value))}
            />
          </div>
          <div className="cm-ctrl-field">
            <label className="cm-ctrl-label">Sort</label>
            <select
              className="cm-ctrl-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="largest">Largest first</option>
              <option value="freq">By frequency</option>
            </select>
          </div>
          <button className="cm-ctrl-refresh" onClick={refresh} title="Refresh library">↻</button>
        </div>
      }
      footer={<RecordBar appId={"capture_manager" as AppId} format="iq" centerHz={freqHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}

      {txStatus && mode && (
        <div className="cm-status-bar">
          <span className="cm-status-bar__dot" data-mode={mode} />
          <span className="cm-status-bar__text">
            {txStatus.kind}
            {txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}
            {txStatus.message ? ` — ${txStatus.message}` : ""}
          </span>
        </div>
      )}

      {recordings.length === 0 ? (
        <div className="cm-empty">
          <div className="cm-empty__icon">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect x="6" y="10" width="44" height="36" rx="6" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="5 3.5" strokeOpacity="0.55" />
              <circle cx="28" cy="28" r="10" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.55" />
              <circle cx="28" cy="28" r="3.5" fill="#8B5CF6" fillOpacity="0.25" />
              <line x1="28" y1="10" x2="28" y2="46" stroke="#8B5CF6" strokeWidth="0.75" strokeOpacity="0.2" />
              <line x1="6" y1="28" x2="50" y2="28" stroke="#8B5CF6" strokeWidth="0.75" strokeOpacity="0.2" />
            </svg>
          </div>
          <div className="cm-empty__title">No IQ captures</div>
          <div className="cm-empty__sub">
            Press <strong>● Record</strong> to start a trigger-based IQ capture,
            or use the Record bar below for continuous recording.
          </div>
        </div>
      ) : (
        <div className="cm-library">
          {sorted.map((meta) => (
            <CaptureCard
              key={meta.id}
              meta={meta}
              onReplay={handleReplay}
              onDelete={handleDelete}
              isReplaying={replayingId === meta.id}
            />
          ))}
        </div>
      )}
    </AppScreen>
  );
}
