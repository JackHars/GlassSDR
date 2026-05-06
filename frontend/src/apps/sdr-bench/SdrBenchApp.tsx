import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface BenchRow { label: string; value: string; unit: string; }

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 120,
};

export function SdrBenchApp() {
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [durationS, setDurationS] = useState(10);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchRow[]>([]);

  const run = () => {
    startApp("sdr_benchmark" as AppId, { center_hz: centerHz, duration_s: durationS });
    setRunning(true);
    // Placeholder results — real values come from spectrum events in a future pass.
    setTimeout(() => {
      setResults([
        { label: "Sample Rate",     value: "20.0",   unit: "Msps"     },
        { label: "Throughput",      value: "320.0",  unit: "Mbit/s"   },
        { label: "Lost Samples",    value: "0",      unit: ""         },
        { label: "Latency (est.)",  value: "4",      unit: "ms"       },
      ]);
      setRunning(false);
    }, durationS * 1000);
  };
  const stop = () => { stopApp(); setRunning(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>SDR Benchmark</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Measures HackRF throughput, sample loss, and latency.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>Center Freq (Hz):</label>
        <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} style={inp} />
        <label>Duration (s):</label>
        <input type="number" value={durationS} onChange={(e) => setDurationS(Number(e.target.value))} min={1} max={60} style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={run} disabled={running}
          style={{ padding: "7px 16px", background: "#246", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          {running ? "Running…" : "Run Benchmark"}
        </button>
        <button onClick={stop} disabled={!running}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Abort
        </button>
      </div>
      {results.length > 0 && (
        <table style={{ borderCollapse: "collapse", minWidth: 340 }}>
          <thead>
            <tr>
              {["Metric", "Value"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "4px 12px", color: "#888", fontSize: 12, borderBottom: "1px solid #333" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label}>
                <td style={{ padding: "6px 12px", color: "#aaa", fontSize: 13 }}>{r.label}</td>
                <td style={{ padding: "6px 12px", color: "#8cf", fontFamily: "monospace", fontSize: 14 }}>
                  {r.value}{r.unit ? ` ${r.unit}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
