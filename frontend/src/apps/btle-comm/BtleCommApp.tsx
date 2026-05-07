import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface BleAdvEvent { mac: string; rssi_db: number; adv_type: string; data_hex: string; }

export function BtleCommApp() {
  const [adverts, setAdverts] = useState<BleAdvEvent[]>([]);
  const [channel, setChannel] = useState(37);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("btle_comm" as AppId, { channel, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<BleAdvEvent>("ble_adv", (e) =>
      setAdverts((prev) => [e.payload, ...prev].slice(0, 500))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="BLE Scanner"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Scanning · {adverts.length} packets</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Scan</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setAdverts([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Start channel" size="md">
            <select value={channel} onChange={(e) => setChannel(Number(e.target.value))}>
              <option value={37}>37</option>
              <option value={38}>38</option>
              <option value={39}>39</option>
            </select>
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"btle_comm" as any} format="jsonl" />}
    >
      <DecoderTable
        headers={["MAC", "RSSI (dB)", "Type", "Data"]}
        rows={adverts}
        renderRow={(a) => [
          <span style={{ color: "var(--accent)" }}>{a.mac}</span>,
          a.rssi_db.toFixed(1),
          <span style={{ color: "#FF9500" }}>{a.adv_type}</span>,
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.data_hex}</span>,
        ]}
        emptyMessage="No advertisers detected — scanner rotates across channels 37, 38, and 39."
      />
    </AppShell>
  );
}
