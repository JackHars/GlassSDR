import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { AprsPacketEvent } from "../../ipc/types/AprsPacketEvent";
import { RecordBar } from "../../components/RecordBar";
import { EntityMap } from "../../components/kit/EntityMap";
import type { MapEntity } from "../../components/kit/EntityMap";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AprsRx.css";

type PacketWithId = AprsPacketEvent & { id: number };

const COLUMNS: DecoderColumn<PacketWithId>[] = [
  { key: "src", label: "Source", width: "110px", mono: true },
  { key: "payload_type", label: "Type", width: "60px" },
  { key: "comment", label: "Comment" },
];

function filterPacket(p: PacketWithId, q: string): boolean {
  return p.src.toLowerCase().includes(q) ||
    p.dst.toLowerCase().includes(q) ||
    p.comment.toLowerCase().includes(q) ||
    p.payload_type.toLowerCase().includes(q);
}

function StationDetail({ p }: { p: PacketWithId }) {
  return (
    <div className="aprs-station-detail">
      <div className="aprs-station-detail__callsign">{p.src}</div>
      <div className="aprs-station-detail__type">{p.payload_type} → {p.dst}</div>
      {p.comment && <div className="aprs-station-detail__comment">{p.comment}</div>}
      {p.lat != null && p.lon != null && (
        <div className="aprs-station-detail__coords">{p.lat.toFixed(5)}°, {p.lon.toFixed(5)}°</div>
      )}
    </div>
  );
}

let _id = 0;

export function AprsRxApp() {
  const [packets, setPackets] = useState<PacketWithId[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const p = listen<AprsPacketEvent>("aprs_packet", (e) =>
      setPackets((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 300))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("aprs_rx" as AppId, { center_hz: 144_390_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  // Derive entities from latest position per callsign
  const stationMap = useMemo(() => {
    const m = new Map<string, PacketWithId>();
    // Newest packets first → take first occurrence of each callsign with position
    for (const p of packets) {
      if (!m.has(p.src) && p.lat != null && p.lon != null) {
        m.set(p.src, p);
      }
    }
    return m;
  }, [packets]);

  const entities = useMemo<MapEntity[]>(() => {
    const result: MapEntity[] = [];
    stationMap.forEach((p) => {
      if (p.lat != null && p.lon != null) {
        result.push({ id: p.src, lat: p.lat, lon: p.lon, kind: "station", label: p.src });
      }
    });
    return result;
  }, [stationMap]);

  const selectedPacket = selected ? stationMap.get(selected) ?? null : null;

  const count = packets.length;
  const stationsWithPos = stationMap.size;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="aprs_rx"
      title="APRS Receiver"
      subtitle="144.390 MHz · 1200 baud"
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} packets` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            144.390 MHz NA · Bell 202 AFSK 1200 baud
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setPackets([]); setSelected(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"aprs_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" />
      }
    >
      <div className="aprs-layout">
        {/* Map column */}
        <div className="aprs-map-col">
          {/* Stats strip */}
          <div className="aprs-stats">
            <div className="aprs-stat">
              <span className="aprs-stat-label">Packets</span>
              <span className="aprs-stat-value">{count}</span>
            </div>
            <div className="aprs-stat">
              <span className="aprs-stat-label">Stations</span>
              <span className="aprs-stat-value">{stationsWithPos}</span>
            </div>
          </div>
          {/* Map */}
          <EntityMap
            entities={entities}
            selected={selected}
            onSelect={setSelected}
            accentColor="#E86020"
            emptyLabel="No stations with position yet"
            detail={selectedPacket ? <StationDetail p={selectedPacket} /> : undefined}
          />
        </div>

        {/* Feed column */}
        <div className="aprs-feed-col">
          <DecoderFeed
            items={packets}
            columns={COLUMNS}
            filterFn={filterPacket}
            emptyLabel="Waiting for APRS packets…"
            emptyIcon="📡"
            renderInspector={(p) => <StationDetail p={p} />}
          />
        </div>
      </div>
    </AppScreen>
  );
}
