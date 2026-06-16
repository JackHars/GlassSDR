import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { AisShipEvent } from "../../ipc/types/AisShipEvent";
import { RecordBar } from "../../components/RecordBar";
import { EntityMap } from "../../components/kit/EntityMap";
import type { MapEntity } from "../../components/kit/EntityMap";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AisRx.css";

function VesselDetail({ ship }: { ship: AisShipEvent }) {
  const courseRad = (ship.course * Math.PI) / 180;
  const dx = Math.sin(courseRad);
  const dy = -Math.cos(courseRad);
  return (
    <div className="ais-vessel-detail">
      <div className="ais-vessel-name">{ship.name ?? "Unknown Vessel"}</div>
      <div className="ais-vessel-mmsi">MMSI {ship.mmsi}</div>
      <div className="ais-vessel-stats">
        <div className="ais-vessel-stat">
          <span className="ais-vessel-stat-label">Speed</span>
          <span className="ais-vessel-stat-value">{ship.speed_kt.toFixed(1)} kt</span>
        </div>
        <div className="ais-vessel-stat">
          <span className="ais-vessel-stat-label">Course</span>
          <span className="ais-vessel-stat-value">
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "inline", marginRight: 2 }}>
              <line x1="7" y1="7" x2={7 + dx * 5} y2={7 + dy * 5} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {ship.course.toFixed(0)}°
          </span>
        </div>
        <div className="ais-vessel-stat">
          <span className="ais-vessel-stat-label">Lat</span>
          <span className="ais-vessel-stat-value">{ship.lat.toFixed(5)}°</span>
        </div>
        <div className="ais-vessel-stat">
          <span className="ais-vessel-stat-label">Lon</span>
          <span className="ais-vessel-stat-value">{ship.lon.toFixed(5)}°</span>
        </div>
      </div>
    </div>
  );
}

export function AisRxApp() {
  const [ships, setShips] = useState<Map<number, AisShipEvent>>(new Map());
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const p = listen<AisShipEvent>("ais_ship", (e) =>
      setShips((prev) => new Map(prev).set(e.payload.mmsi, e.payload))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("ais_rx" as AppId, { center_hz: 161_975_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const entities = useMemo<MapEntity[]>(() => {
    const result: MapEntity[] = [];
    ships.forEach((s) => {
      result.push({
        id: String(s.mmsi),
        lat: s.lat,
        lon: s.lon,
        kind: "ship",
        label: s.name ?? String(s.mmsi),
        heading: s.course,
      });
    });
    return result;
  }, [ships]);

  const count = ships.size;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";
  const selectedShip = selected ? ships.get(Number(selected)) ?? null : null;

  return (
    <AppScreen
      appId="ais_rx"
      title="AIS Receiver"
      subtitle="161.975 MHz · Marine VHF"
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} vessels` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            Marine VHF · Ch 87B 161.975 + Ch 88B 162.025 MHz
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setShips(new Map()); setSelected(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"ais_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={161_975_000} />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0 }}>
        {/* Stats strip */}
        <div className="ais-stats">
          <div className="ais-stat">
            <span className="ais-stat-label">Vessels tracked</span>
            <span className="ais-stat-value">{count}</span>
          </div>
          <div className="ais-stat">
            <span className="ais-stat-label">Channel</span>
            <span className="ais-stat-value">87B+88B</span>
          </div>
        </div>

        {/* Marine chart (EntityMap) with sonar sweep motif */}
        <div className="ais-map-wrap">
          <EntityMap
            entities={entities}
            selected={selected}
            onSelect={setSelected}
            accentColor="#0A7ABE"
            emptyLabel="No vessels — start to receive AIS"
            detail={selectedShip ? <VesselDetail ship={selectedShip} /> : undefined}
          />
          {/* Sonar sweep motif */}
          {running && (
            <svg className="ais-sonar-sweep" viewBox="0 0 300 300" aria-hidden>
              <circle cx="150" cy="150" r="60" />
              <circle cx="150" cy="150" r="100" />
              <circle cx="150" cy="150" r="140" />
              <path
                className="sweep-sector"
                d="M150,150 L150,20 A130,130 0 0,1 222,87 Z"
              />
            </svg>
          )}
        </div>
      </div>
    </AppScreen>
  );
}
