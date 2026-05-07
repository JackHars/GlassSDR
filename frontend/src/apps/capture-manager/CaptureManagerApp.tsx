import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

type Mode = "record" | "replay";

export function CaptureManagerApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleAction = async (selectedMode: Mode) => {
    if (selectedMode === "replay" && !legalAccepted) { setShowLegal(true); return; }
    setMode(selectedMode);
    await startApp("capture_manager" as AppId, {
      mode: selectedMode,
      center_hz: freqHz,
      threshold_db: thresholdDb,
      lna_gain_db: 40, vga_gain_db: 20,
    });
  };
  const handleStop = async () => { await stopApp(); setMode(null); };

  return (
    <AppShell
      title="Capture Manager"
      status={
        mode === "record" ? <><span style={{color: "#34C759"}}>●</span> Recording · trigger {thresholdDb} dB</>
        : mode === "replay" ? <><span style={{color: "#FF3B30"}}>●</span> Replaying</>
        : <><span style={{color: "#999"}}>○</span> Idle · trigger {thresholdDb} dB</>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={() => handleAction("record")}>Record</button>
              <button className="glass-btn" onClick={() => handleAction("replay")} style={{ background: "#FF9500", color: "#fff" }}>Replay</button>
              <button className="glass-btn" onClick={handleStop} disabled={!mode}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
          <ControlField label={`Trigger ${thresholdDb} dB`} size="md">
            <input type="range" min={-80} max={0} value={thresholdDb} onChange={(e) => setThresholdDb(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"capture_manager" as any} format="iq" centerHz={freqHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.4)", borderRadius: 10, color: "#A86200", fontSize: 13 }}>
          <strong>OWN DEVICES ONLY</strong> — only replay signals you are authorised to retransmit.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Trigger-based capture</h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Records IQ samples to disk only when the signal exceeds the configured threshold.
            Replay sends a previously captured IQ file at the same frequency.
          </div>
        </div>
        {txStatus && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}
