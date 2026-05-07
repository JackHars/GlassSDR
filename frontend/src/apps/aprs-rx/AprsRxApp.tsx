import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlRow } from "../../components/AppShell";

interface AprsPacketEvent {
  src: string;
  dst: string;
  payload_type: string;
  lat: number | null;
  lon: number | null;
  comment: string;
}

export function AprsRxApp() {
  const [packets, setPackets] = useState<AprsPacketEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("aprs_rx" as AppId, { center_hz: 144_390_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => {
    await stopApp();
    setRunning(false);
  };

  useEffect(() => {
    const unlisten = listen<AprsPacketEvent>("aprs_packet", (e) =>
      setPackets((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="APRS Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · 144.390 MHz · {packets.length} packets</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setPackets([])}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Tuned to 144.390 MHz (NA) · 1200 baud Bell 202 AFSK
          </span>
        </ControlRow>
      }
      footer={<RecordBar appId={"aprs_rx" as any} format="jsonl" />}
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.85)", textAlign: "left", backdropFilter: "blur(8px)" }}>
              <th style={{ padding: "8px 12px" }}>Source</th>
              <th style={{ padding: "8px 12px" }}>Dest</th>
              <th style={{ padding: "8px 12px" }}>Type</th>
              <th style={{ padding: "8px 12px" }}>Lat</th>
              <th style={{ padding: "8px 12px" }}>Lon</th>
              <th style={{ padding: "8px 12px" }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{p.src}</td>
                <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{p.dst}</td>
                <td style={{ padding: "6px 12px" }}>{p.payload_type}</td>
                <td style={{ padding: "6px 12px" }}>{p.lat != null ? p.lat.toFixed(5) : "—"}</td>
                <td style={{ padding: "6px 12px" }}>{p.lon != null ? p.lon.toFixed(5) : "—"}</td>
                <td style={{ padding: "6px 12px", color: "var(--text-secondary)" }}>{p.comment}</td>
              </tr>
            ))}
            {packets.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
                No packets yet — press Start to listen.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
