import { useEffect, useRef, useState } from "react";
import {
  startRecording,
  stopRecording,
} from "../ipc/commands";
import { onRecordingStatus } from "../ipc/events";
import type { AppId } from "../ipc/types/AppId";
import type { RecordingFormat } from "../ipc/types/RecordingFormat";
import type { RecordingMeta } from "../ipc/types/RecordingMeta";

interface Props {
  appId: AppId;
  format: RecordingFormat;
  centerHz?: number;
  /** Called after a successful stop, with the saved recording metadata. */
  onSaved?: (meta: RecordingMeta) => void;
}

const formatLabel: Record<RecordingFormat, string> = {
  wav: "WAV",
  jsonl: "log",
  iq: "IQ",
  img: "PNG",
};

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordButton({ appId, format, centerHz, onSaved }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    const unlisten = onRecordingStatus((s) => {
      if (s.id !== sessionId.current) return;
      setElapsedMs(s.elapsed_ms);
      setBytes(s.bytes_written);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    try {
      const id = await startRecording(appId, format, centerHz);
      sessionId.current = id;
      setRecording(true);
      setElapsedMs(0);
      setBytes(0);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleStop = async () => {
    try {
      const meta = await stopRecording();
      setRecording(false);
      sessionId.current = null;
      onSaved?.(meta);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
      <button
        onClick={recording ? handleStop : handleStart}
        title={recording ? "Stop recording" : `Record ${formatLabel[format]}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: recording ? "rgba(255,59,48,0.18)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${recording ? "rgba(255,59,48,0.6)" : "rgba(255,255,255,0.18)"}`,
          color: recording ? "#ff5a4e" : "#ddd",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: recording ? "#ff3b30" : "rgba(255,255,255,0.4)",
            boxShadow: recording ? "0 0 8px rgba(255,59,48,0.7)" : "none",
            animation: recording ? "rec-pulse 1s ease-in-out infinite" : "none",
          }}
        />
        {recording ? "Stop" : `Record ${formatLabel[format]}`}
      </button>
      {recording && (
        <span style={{ color: "#bbb" }}>
          {fmtTime(elapsedMs)} · {fmtBytes(bytes)}
        </span>
      )}
      {error && <span style={{ color: "#ff5a4e" }}>{error}</span>}
      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
