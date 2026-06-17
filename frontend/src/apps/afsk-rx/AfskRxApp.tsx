import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { AfskBitEvent } from "../../ipc/types/AfskBitEvent";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AfskRx.css";

type Frame = AfskBitEvent & { id: number };
let _id = 0;

export function AfskRxApp() {
  const [freqHz, setFreqHz] = useState(144_800_000);
  const [markHz, setMarkHz] = useState(1200);
  const [spaceHz, setSpaceHz] = useState(2200);
  const [baud, setBaud] = useState(1200);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<AfskBitEvent>("afsk_bits", (e) =>
      setFrames((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 100))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("afsk_rx" as AppId, {
      center_hz: freqHz, mark_hz: markHz, space_hz: spaceHz,
      baud_rate: baud, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const count = frames.length;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="afsk_rx"
      title="AFSK Receiver"
      subtitle={`${(freqHz / 1e6).toFixed(4)} MHz · ${baud} baud`}
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} frames` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Mark (Hz)</label>
              <input type="number" value={markHz} style={{ width: 80 }} onChange={(e) => setMarkHz(+e.target.value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Space (Hz)</label>
              <input type="number" value={spaceHz} style={{ width: 80 }} onChange={(e) => setSpaceHz(+e.target.value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Baud</label>
              <input type="number" value={baud} style={{ width: 80 }} onChange={(e) => setBaud(+e.target.value)} />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setFrames([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"afsk_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div className="afsk-frames">
        {frames.length === 0 && (
          <div className="afsk-empty">
            <span className="afsk-empty-icon">〜</span>
            <span className="afsk-empty-label">No AFSK frames yet — press Start to listen</span>
          </div>
        )}
        {frames.map((f) => (
          <div key={f.id} className="afsk-frame">
            <div className="afsk-frame__hex">{f.hex_dump}</div>
            {f.decoded_ascii && <div className="afsk-frame__ascii">{f.decoded_ascii}</div>}
          </div>
        ))}
      </div>
    </AppScreen>
  );
}
