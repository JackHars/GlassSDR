import { useEffect, useMemo, useState, useCallback } from "react";
import { deleteRecording, listRecordings } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import type { AppId } from "../../ipc/types/AppId";
import type { RecordingMeta } from "../../ipc/types/RecordingMeta";
import type { RecordingFormat } from "../../ipc/types/RecordingFormat";
import "./Recordings.css";

const FORMAT_LABEL: Record<RecordingFormat, string> = {
  wav:  "Audio",
  jsonl: "Log",
  iq:   "IQ",
  img:  "Image",
};

const FORMAT_COLOR: Record<RecordingFormat, string> = {
  wav:   "#34C759",
  jsonl: "#0066DD",
  iq:    "#C4463A",
  img:   "#a855f7",
};

function fmtTimestamp(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtHz(hz: number | null): string {
  if (!hz) return "—";
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  return `${(hz / 1e3).toFixed(1)} kHz`;
}

function fileName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function appLabel(id: AppId): string {
  return String(id).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// App color hints (reuse from theme — pulled from common knowledge)
const APP_COLORS: Partial<Record<string, string>> = {
  nfm_audio: "#F0A03A", wfm_rx: "#6040D0", am_rx: "#D09030",
  adsb_rx: "#22C55E", adsb_rx_ext: "#16A34A", aprs_rx: "#F97316",
  ais_rx: "#0EA5E9", acars_rx: "#06B6D4", pocsag_rx: "#EC4899",
  flex_rx: "#E879F9", dmr_rx: "#8B5CF6", p25_rx: "#3B82F6",
  tetra_rx: "#7C3AED", apt_rx: "#8B5CF6", capture_manager: "#8B5CF6",
  sub_ghz_capture: "#5878B0", protocol_analyzer: "#4A6FA5",
  iq_player: "#00B4CC", sdr_benchmark: "#4CAF7A",
};

// ── Recording Row ─────────────────────────────────────────────────────────────

interface RecRowProps {
  meta: RecordingMeta;
  onDelete: (path: string) => void;
}

function RecRow({ meta, onDelete }: RecRowProps) {
  const fmtColor = FORMAT_COLOR[meta.format];
  return (
    <div className="rec-row">
      <span
        className="rec-row__fmt"
        style={{ color: fmtColor, background: fmtColor + "18", borderColor: fmtColor + "40" }}
      >
        {FORMAT_LABEL[meta.format]}
      </span>
      <span className="rec-row__name" title={meta.path}>{fileName(meta.path)}</span>
      <span className="rec-row__freq">{fmtHz(meta.center_hz)}</span>
      <span className="rec-row__time">{fmtTimestamp(meta.started_unix_ms)}</span>
      <span className="rec-row__dur">{fmtDuration(meta.duration_ms)}</span>
      <span className="rec-row__size">{fmtSize(meta.size_bytes)}</span>
      <button className="rec-row__del" onClick={() => onDelete(meta.path)}>×</button>
    </div>
  );
}

// ── App Group ─────────────────────────────────────────────────────────────────

interface AppGroupProps {
  appId: AppId;
  items: RecordingMeta[];
  onDelete: (path: string) => void;
  defaultOpen?: boolean;
}

function AppGroup({ appId, items, onDelete, defaultOpen = true }: AppGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const appColor = APP_COLORS[String(appId)] ?? "#888";
  const totalSize = items.reduce((a, m) => a + m.size_bytes, 0);

  return (
    <div className="rec-group">
      <button
        className="rec-group__header"
        onClick={() => setOpen((v) => !v)}
        style={{ borderLeftColor: appColor }}
      >
        <span className="rec-group__chevron">{open ? "▾" : "▸"}</span>
        <span className="rec-group__app-dot" style={{ background: appColor }} />
        <span className="rec-group__app-name">{appLabel(appId)}</span>
        <span className="rec-group__meta">
          {items.length} recording{items.length !== 1 ? "s" : ""} · {fmtSize(totalSize)}
        </span>
      </button>

      {open && (
        <div className="rec-group__rows">
          <div className="rec-row rec-row--head">
            <span>Format</span>
            <span>File</span>
            <span>Frequency</span>
            <span>When</span>
            <span>Duration</span>
            <span>Size</span>
            <span />
          </div>
          {items.map((m) => (
            <RecRow key={m.id} meta={m} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RecordingsApp() {
  const [items, setItems]         = useState<RecordingMeta[]>([]);
  const [filter, setFilter]       = useState<"all" | RecordingFormat>("all");
  const [search, setSearch]       = useState("");

  const refresh = useCallback(() => {
    listRecordings().then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleDelete = async (path: string) => {
    await deleteRecording(path);
    refresh();
  };

  const visible = useMemo(() => {
    let list = items;
    if (filter !== "all") list = list.filter((m) => m.format === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        fileName(m.path).toLowerCase().includes(q) ||
        String(m.app_id).includes(q)
      );
    }
    return list;
  }, [items, filter, search]);

  const groups = useMemo(() => {
    const map = new Map<AppId, RecordingMeta[]>();
    for (const m of visible) {
      if (!map.has(m.app_id)) map.set(m.app_id, []);
      map.get(m.app_id)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => appLabel(a[0]).localeCompare(appLabel(b[0])));
  }, [visible]);

  const totalSize = items.reduce((acc, m) => acc + m.size_bytes, 0);

  return (
    <AppScreen
      appId="recordings"
      title="Recordings"
      subtitle="Archive Library"
      status="idle"
      statusText={`${items.length} recordings · ${fmtSize(totalSize)}`}
      actions={
        <button className="rec-refresh-btn" onClick={refresh}>↻ Refresh</button>
      }
      controls={
        <div className="rec-controls">
          <input
            className="rec-search"
            type="text"
            placeholder="Search files or apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rec-format-tabs">
            {(["all", "wav", "jsonl", "iq", "img"] as const).map((f) => (
              <button
                key={f}
                className={`rec-fmt-tab${filter === f ? " rec-fmt-tab--on" : ""}`}
                onClick={() => setFilter(f)}
                style={f !== "all" && filter === f ? { background: FORMAT_COLOR[f as RecordingFormat], color: "#fff", borderColor: FORMAT_COLOR[f as RecordingFormat] } : undefined}
              >
                {f === "all" ? "All" : FORMAT_LABEL[f as RecordingFormat]}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="rec-layout">
        {groups.length === 0 ? (
          <GlassPanel>
            <div className="rec-empty">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="16" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 3.5" strokeOpacity="0.5" />
                <circle cx="24" cy="24" r="6" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" />
                <circle cx="24" cy="24" r="2.5" fill="var(--accent)" fillOpacity="0.3" />
              </svg>
              <div className="rec-empty__title">
                {items.length === 0 ? "No recordings yet" : "No matches"}
              </div>
              <div className="rec-empty__sub">
                {items.length === 0
                  ? "Use the Record button in any app to create recordings."
                  : "Try a different format filter or search term."}
              </div>
            </div>
          </GlassPanel>
        ) : (
          <div className="rec-groups">
            {groups.map(([appId, list]) => (
              <AppGroup
                key={String(appId)}
                appId={appId}
                items={list}
                onDelete={handleDelete}
                defaultOpen={groups.length <= 3}
              />
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
