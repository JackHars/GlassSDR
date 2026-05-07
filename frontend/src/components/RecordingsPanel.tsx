import { useCallback, useEffect, useState } from "react";
import { deleteRecording, listRecordings } from "../ipc/commands";
import type { AppId } from "../ipc/types/AppId";
import type { RecordingMeta } from "../ipc/types/RecordingMeta";

interface Props {
  appId: AppId;
  /** A version counter — bumping it triggers a refresh. Pass the latest saved id, or use any monotonic value. */
  refreshKey?: string | number;
}

function fmtTimestamp(ms: number): string {
  if (!ms) return "?";
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
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

export function RecordingsPanel({ appId, refreshKey }: Props) {
  const [items, setItems] = useState<RecordingMeta[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    listRecordings(appId).then(setItems).catch(() => setItems([]));
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleDelete = async (path: string) => {
    try {
      await deleteRecording(path);
      refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: 0,
          background: "transparent",
          border: "none",
          color: "#ccc",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span>Recordings ({items.length})</span>
        <span style={{ opacity: 0.6 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 220, overflow: "auto" }}>
          {items.length === 0 && (
            <div style={{ color: "#888", padding: "6px 0" }}>No recordings yet.</div>
          )}
          {items.map((m) => (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 70px 70px 60px",
                gap: 8,
                padding: "4px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: "#bbb",
                fontFamily: "var(--font-mono, monospace)",
              }}
              title={m.path}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fileName(m.path)}
              </span>
              <span>{fmtTimestamp(m.started_unix_ms)}</span>
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
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
