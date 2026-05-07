import { useEffect, useMemo, useState } from "react";
import { deleteRecording, listRecordings } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { RecordingMeta } from "../../ipc/types/RecordingMeta";
import type { RecordingFormat } from "../../ipc/types/RecordingFormat";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

const FORMAT_LABEL: Record<RecordingFormat, string> = {
  wav: "Audio (WAV)",
  jsonl: "Log (JSONL)",
  iq: "IQ samples",
  img: "Image (PNG)",
};

const FORMAT_COLOR: Record<RecordingFormat, string> = {
  wav: "#34C759",
  jsonl: "#0066DD",
  iq: "#FF9500",
  img: "#a855f7",
};

function fmtTimestamp(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fileName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function appPretty(id: AppId): string {
  return String(id).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecordingsApp() {
  const [items, setItems] = useState<RecordingMeta[]>([]);
  const [filter, setFilter] = useState<"all" | AppId>("all");

  const refresh = () => {
    listRecordings().then(setItems).catch(() => setItems([]));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<AppId, RecordingMeta[]>();
    for (const r of items) {
      if (!m.has(r.app_id)) m.set(r.app_id, []);
      m.get(r.app_id)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => appPretty(a[0]).localeCompare(appPretty(b[0])));
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter(([id]) => id === filter);
  }, [groups, filter]);

  const totalSize = items.reduce((acc, m) => acc + m.size_bytes, 0);

  const handleDelete = async (path: string) => {
    try { await deleteRecording(path); refresh(); } catch { /* ignore */ }
  };

  return (
    <AppShell
      title="Recordings"
      status={<span>{items.length} recordings · {fmtSize(totalSize)} total</span>}
      controls={
        <ControlRow
          actions={<button className="glass-btn" onClick={refresh}>Refresh</button>}
        >
          <ControlField label="Filter by app" size="lg">
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All apps ({items.length})</option>
              {groups.map(([id, list]) => (
                <option key={String(id)} value={String(id)}>
                  {appPretty(id)} ({list.length})
                </option>
              ))}
            </select>
          </ControlField>
        </ControlRow>
      }
    >
      <div className="app-shell__grow" style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
        {items.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)", padding: 32 }}>
            <div style={{ fontSize: 40 }}>●</div>
            <div style={{ fontSize: 15 }}>No recordings yet</div>
            <div style={{ fontSize: 13 }}>
              Open any app and tap the red Record button to capture data.
            </div>
          </div>
        )}

        {visible.map(([appId, list]) => (
          <section
            key={String(appId)}
            style={{
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.7)",
              borderRadius: 12,
              padding: 14,
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>{appPretty(appId)}</h3>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {list.length} recording{list.length === 1 ? "" : "s"} · {fmtSize(list.reduce((a, m) => a + m.size_bytes, 0))}
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 130px 90px 90px 70px",
              gap: 8,
              fontSize: 11,
              fontWeight: 650,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "var(--text-secondary)",
              padding: "6px 8px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}>
              <span>File</span>
              <span>Format</span>
              <span>When</span>
              <span>Duration</span>
              <span>Size</span>
              <span />
            </div>
            {list.map((m) => (
              <div
                key={m.id}
                title={m.path}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 130px 90px 90px 70px",
                  gap: 8,
                  padding: "8px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fileName(m.path)}
                </span>
                <span style={{ color: FORMAT_COLOR[m.format], fontFamily: "var(--font-sans)", fontSize: 12 }}>
                  {FORMAT_LABEL[m.format]}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{fmtTimestamp(m.started_unix_ms)}</span>
                <span>{fmtDuration(m.duration_ms)}</span>
                <span>{fmtSize(m.size_bytes)}</span>
                <button
                  onClick={() => handleDelete(m.path)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,80,80,0.4)",
                    color: "#ff8080",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "1px 6px",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
