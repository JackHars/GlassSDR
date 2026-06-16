/**
 * Shared inner component for the digital-voice 🧩 cluster.
 * DMR, dPMR, P25, NXDN, and TETRA receivers all use this with
 * different appId (for theming) and protocol string (for filtering).
 */
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { FieldInspector } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import type { AllAppId } from "../../theme/appThemes";
import "./DigitalVoiceRx.css";

interface DigitalVoiceEvent { protocol: string; talkgroup: number; source_id: number; call_type: string; }
type Call = DigitalVoiceEvent & { id: number };

interface DigitalVoiceRxInnerProps {
  appId: AllAppId;
  title: string;
  protocol: string;
  defaultFreqHz: number;
  subtitle?: string;
}

const COLUMNS: DecoderColumn<Call>[] = [
  { key: "talkgroup", label: "TG", width: "70px", mono: true },
  { key: "source_id", label: "Source", width: "80px", mono: true },
  { key: "call_type", label: "Type", width: "80px",
    render: (c) => <span className="dv-call-type">{c.call_type}</span> },
];

let _id = 0;

export function DigitalVoiceRxInner({ appId, title, protocol, defaultFreqHz, subtitle }: DigitalVoiceRxInnerProps) {
  const [freqHz, setFreqHz] = useState(defaultFreqHz);
  const [calls, setCalls] = useState<Call[]>([]);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<DigitalVoiceEvent>("digital_voice", (e) => {
      if (e.payload.protocol !== protocol) return;
      const call: Call = { ...e.payload, id: ++_id };
      setCalls((prev) => [call, ...prev].slice(0, 300));
      setActiveCall(call);
      // Clear active call after 5 seconds
      const t = setTimeout(() => setActiveCall(null), 5000);
      return () => clearTimeout(t);
    });
    return () => { p.then((f) => f()); };
  }, [protocol]);

  const handleStart = async () => {
    await startApp(appId as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (activeCall ? "live" : calls.length > 0 ? "acquiring" : "idle") : "idle";

  return (
    <AppScreen
      appId={appId}
      title={title}
      subtitle={subtitle ?? `${(freqHz / 1e6).toFixed(4)} MHz · ${protocol}`}
      status={appStatus}
      statusText={running ? (activeCall ? "Active call" : calls.length > 0 ? `${calls.length} calls` : "Scanning") : "Idle"}
      actions={<div className="dv-protocol-badge">{protocol}</div>}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 140 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setCalls([]); setActiveCall(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={appId as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0 }}>
        {/* Stats strip */}
        <div className="dv-stats">
          <div className="dv-stat">
            <span className="dv-stat-label">Calls</span>
            <span className="dv-stat-value">{calls.length}</span>
          </div>
        </div>

        {/* Active call banner */}
        {activeCall && (
          <div className="dv-active-call">
            <div className="dv-active-call__header">
              <div className="dv-active-call__dot" />
              <span className="dv-active-call__label">Active call</span>
            </div>
            <div className="dv-active-call__info">
              <div className="dv-active-call__field">
                <span className="dv-active-call__field-label">Talkgroup</span>
                <span className="dv-active-call__field-value">{activeCall.talkgroup}</span>
              </div>
              <div className="dv-active-call__field">
                <span className="dv-active-call__field-label">Source</span>
                <span className="dv-active-call__field-value">{activeCall.source_id}</span>
              </div>
              <div className="dv-active-call__field">
                <span className="dv-active-call__field-label">Type</span>
                <span className="dv-active-call__field-value">{activeCall.call_type}</span>
              </div>
            </div>
          </div>
        )}

        {/* Call log feed */}
        <DecoderFeed
          items={calls}
          columns={COLUMNS}
          filterFn={(c, q) => String(c.talkgroup).includes(q) || String(c.source_id).includes(q) || c.call_type.includes(q)}
          emptyLabel={`Scanning for ${protocol} traffic…`}
          emptyIcon="📻"
          renderInspector={(c) => (
            <FieldInspector
              title={`TG ${c.talkgroup}`}
              fields={[
                { label: "Protocol", value: c.protocol, mono: true },
                { label: "Talkgroup", value: c.talkgroup, mono: true, accent: true },
                { label: "Source ID", value: c.source_id, mono: true },
                { label: "Call Type", value: c.call_type },
              ]}
            />
          )}
        />
      </div>
    </AppScreen>
  );
}
