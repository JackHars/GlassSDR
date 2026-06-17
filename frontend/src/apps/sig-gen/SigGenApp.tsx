import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import type { AppStatus } from "../../components/kit/AppScreen";
import "../../components/kit/ArmConsole.css";

type TxStatus = { kind: "idle" } | { kind: "transmitting"; progress_pct: number } | { kind: "error"; message: string } | { kind: string };

const WAVEFORMS = ["sine", "square", "sawtooth", "triangle", "noise"];

export function SigGenApp() {
  const [freqHz, setFreqHz] = useState(100_000_000);
  const [waveform, setWaveform] = useState("sine");
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });

  useEffect(() => {
    const p = listen<TxStatus>("pocsag_tx_status", (e) => setStatus(e.payload));
    return () => { p.then((f) => f()); };
  }, []);

  const handleArm = async () => {
    setArmed(true);
    await startApp("sig_gen" as AppId, { center_hz: freqHz, waveform, vga_gain_db: 20, amp_enabled: false });
  };
  const handleDisarm = async () => { setArmed(false); await stopApp(); };

  const appStatus: AppStatus = armed ? "live" : "idle";

  return (
    <AppScreen
      appId="sig_gen"
      title="Signal Generator"
      subtitle={armed ? `${(freqHz / 1e6).toFixed(3)} MHz · ${waveform}` : undefined}
      status={appStatus}
      statusText={armed ? `Generating ${waveform}` : "Idle"}
      controls={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Waveform</label>
            <select value={waveform} onChange={(e) => setWaveform(e.target.value)} disabled={armed}>
              {WAVEFORMS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} disabled={armed} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            {armed
              ? <button className="arm-console__btn arm-console__btn--disarm" onClick={handleDisarm}>Stop</button>
              : <button className="arm-console__btn arm-console__btn--arm" onClick={handleArm}>ARM</button>}
          </div>
        </div>
      }
      footer={<RecordBar appId={"sig_gen" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={freqHz} />}
    >
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.2)", borderRadius: 8, color: "#9A6400", fontSize: 12 }}>
          <Icon name="warning" size={16} /> INDOOR TEST ONLY — only permitted in a shielded environment or Faraday enclosure
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>{waveform} wave</span>
          <div style={{ fontSize: 52, fontFamily: "var(--font-mono)", color: armed ? "var(--danger)" : "var(--text-tertiary)", letterSpacing: -2 }}>
            {(freqHz / 1e6).toFixed(3)} MHz
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
            {status.kind}
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
