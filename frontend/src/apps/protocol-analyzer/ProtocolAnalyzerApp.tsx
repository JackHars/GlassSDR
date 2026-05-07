import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

export function ProtocolAnalyzerApp() {
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [symbolRate, setSymbolRate] = useState(9600);
  const [running, setRunning] = useState(false);

  const start = async () => {
    await startApp("protocol_analyzer" as AppId, { center_hz: freqHz, symbol_rate: symbolRate });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  return (
    <AppShell
      title="Protocol Analyzer"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Capturing · {symbolRate} bps</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={start} disabled={running}>Capture</button>
              <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Symbol Rate (bps)" size="md">
            <input type="number" value={symbolRate} onChange={(e) => setSymbolRate(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"protocol_analyzer" as any} format="iq" centerHz={freqHz} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, background: "#0a0a16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            Eye diagram — capture a signal to populate
          </span>
        </div>
      </div>
    </AppShell>
  );
}
