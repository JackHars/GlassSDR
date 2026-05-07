import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface OokDecodeEvent { protocol: string; code_hex: string; }

export function Nrf24RxApp() {
  const [packets, setPackets] = useState<OokDecodeEvent[]>([]);
  const [channel, setChannel] = useState(76);
  const [address, setAddress] = useState("E7E7E7E7E7");
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("nrf24_rx" as AppId, { channel, address, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<OokDecodeEvent>("ook_decode", (e) =>
      setPackets((prev) => [e.payload, ...prev].slice(0, 300))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="nRF24 Sniffer"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Sniffing · ch {channel} · {packets.length} packets</> : <><span style={{color: "#999"}}>○</span> Idle</>}
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
          <ControlField label="Channel (0–125)" size="sm">
            <input type="number" min={0} max={125} value={channel} onChange={(e) => setChannel(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Address (hex)" size="md">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="E7E7E7E7E7" />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"nrf24_rx" as any} format="jsonl" />}
    >
      <DecoderTable
        headers={["Protocol", "Payload (hex)"]}
        rows={packets}
        renderRow={(p) => [<span style={{ color: "var(--accent)" }}>{p.protocol}</span>, p.code_hex]}
        emptyMessage="No packets yet — Enhanced ShockBurst frames will appear here."
      />
    </AppShell>
  );
}
