import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

type TxStatus =
  | { kind: "idle" }
  | { kind: "armed" }
  | { kind: "transmitting"; progress_pct: number }
  | { kind: "complete" }
  | { kind: "error"; message: string };

const WAVEFORMS = ["sine", "square", "sawtooth", "triangle", "noise"];

export function SigGenApp() {
  const [freqHz, setFreqHz] = useState(100_000_000);
  const [waveform, setWaveform] = useState("sine");
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });

  const handleArm = async () => {
    setArmed(true);
    await startApp("sig_gen" as AppId, {
      center_hz: freqHz, waveform, vga_gain_db: 20, amp_enabled: false,
    });
  };
  const handleDisarm = async () => { setArmed(false); await stopApp(); };

  useEffect(() => {
    const unlisten = listen<TxStatus>("pocsag_tx_status", (e) => setStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Signal Generator"
      status={
        armed ? <><span style={{color: "#FF3B30"}}>●</span> Generating · {waveform} · {(freqHz / 1e6).toFixed(3)} MHz</>
        : <><span style={{color: "#999"}}>○</span> Idle</>
      }
      controls={
        <ControlRow
          actions={
            armed
              ? <button className="glass-btn" onClick={handleDisarm} style={{ background: "rgba(255,59,48,0.15)", color: "#FF3B30", border: "1px solid rgba(255,59,48,0.4)" }}>Disarm</button>
              : <button className="glass-btn primary" onClick={handleArm}>Arm</button>
          }
        >
          <ControlField label="Waveform" size="md">
            <select value={waveform} onChange={(e) => setWaveform(e.target.value)}>
              {WAVEFORMS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </ControlField>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"sig_gen" as any} format="iq" centerHz={freqHz} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.4)", borderRadius: 10, color: "#A86200", fontSize: 13 }}>
          <strong>INDOOR TEST ONLY</strong> — transmission is only permitted in a shielded
          environment or Faraday enclosure. Comply with local regulations before transmitting.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>
            {waveform} wave
          </div>
          <div style={{ fontSize: 56, fontFamily: "var(--font-mono)", color: armed ? "#FF3B30" : "var(--text-tertiary)" }}>
            {(freqHz / 1e6).toFixed(3)} MHz
          </div>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 13 }}>
            Status:{" "}
            {status.kind === "transmitting"
              ? `transmitting (${status.progress_pct}%)`
              : status.kind === "error"
              ? <span style={{ color: "#FF3B30" }}>{status.message}</span>
              : status.kind}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
