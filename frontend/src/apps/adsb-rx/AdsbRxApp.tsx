import { useEffect, useMemo, useState } from "react";
import { startAdsb, stopApp } from "../../ipc/commands";
import { onAircraftState, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import { RecordBar } from "../../components/RecordBar";
import { EntityMap } from "../../components/kit/EntityMap";
import type { MapEntity } from "../../components/kit/EntityMap";
import type { AircraftState } from "../../ipc/types/AircraftState";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AdsbRx.css";

function vertArrow(fpm: number): { char: string; cls: string } {
  if (fpm > 100) return { char: "▲", cls: "up" };
  if (fpm < -100) return { char: "▼", cls: "down" };
  return { char: "━", cls: "flat" };
}

function AircraftDetail({ ac }: { ac: AircraftState }) {
  const arrow = ac.velocity ? vertArrow(ac.velocity.vert_rate_fpm) : null;
  return (
    <div className="adsb-detail">
      <div className="adsb-detail__callsign">{ac.callsign ?? "——"}</div>
      <div className="adsb-detail__icao">ICAO {ac.icao24.toUpperCase()}</div>
      <div className="adsb-detail__stats">
        {ac.position?.altitude_ft !== null && ac.position?.altitude_ft !== undefined && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">Altitude</span>
            <span className="adsb-detail__stat-value">
              {arrow && (
                <span className={`adsb-vert-arrow adsb-vert-arrow--${arrow.cls}`}>{arrow.char}</span>
              )}
              {ac.position.altitude_ft.toLocaleString()} ft
            </span>
          </div>
        )}
        {ac.velocity && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">Speed</span>
            <span className="adsb-detail__stat-value">{Math.round(ac.velocity.ground_speed_kt)} kt</span>
          </div>
        )}
        {ac.velocity && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">Heading</span>
            <span className="adsb-detail__stat-value">{Math.round(ac.velocity.heading_deg)}°</span>
          </div>
        )}
        {ac.velocity && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">V/S</span>
            <span className="adsb-detail__stat-value">
              {ac.velocity.vert_rate_fpm > 0 ? "+" : ""}{Math.round(ac.velocity.vert_rate_fpm)} fpm
            </span>
          </div>
        )}
        {ac.position && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">Lat</span>
            <span className="adsb-detail__stat-value">{ac.position.lat.toFixed(4)}°</span>
          </div>
        )}
        {ac.position && (
          <div className="adsb-detail__stat">
            <span className="adsb-detail__stat-label">Lon</span>
            <span className="adsb-detail__stat-value">{ac.position.lon.toFixed(4)}°</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdsbRxApp() {
  const aircraft = useStore((s) => s.aircraft);
  const upsertAircraft = useStore((s) => s.upsertAircraft);
  const clearAircraft = useStore((s) => s.clearAircraft);
  const status = useStore((s) => s.status);
  const setStatus = useStore((s) => s.setStatus);
  const running = status.kind === "running" || status.kind === "starting";
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onAircraftState(upsertAircraft);
    const u2 = onAppStatus(setStatus);
    return () => { u1.then((f) => f()); u2.then((f) => f()); };
  }, [upsertAircraft, setStatus]);

  // Map aircraft store to EntityMap entities
  const entities = useMemo<MapEntity[]>(() => {
    const result: MapEntity[] = [];
    aircraft.forEach((ac) => {
      if (!ac.position) return;
      result.push({
        id: ac.icao24,
        lat: ac.position.lat,
        lon: ac.position.lon,
        kind: "aircraft",
        label: ac.callsign ?? ac.icao24,
        heading: ac.velocity?.heading_deg,
      });
    });
    return result;
  }, [aircraft]);

  const selectedAc = selected ? aircraft.get(selected) ?? null : null;

  const count = aircraft.size;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="adsb_rx"
      title="ADS-B Receiver"
      subtitle="1090 MHz · Mode S"
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} aircraft` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            Passive receive · 1090 MHz Mode S squitter
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="glass-btn primary" onClick={() => startAdsb({})} disabled={running}>Start</button>
            <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { clearAircraft(); setSelected(null); }} disabled={count === 0}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"adsb_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" />
      }
    >
      {/* Hero: map with range rings + selected aircraft detail */}
      <div className="adsb-map-wrap">
        <EntityMap
          entities={entities}
          selected={selected}
          onSelect={setSelected}
          accentColor="#0DB88A"
          emptyLabel="No aircraft — start receiving on 1090 MHz"
          detail={selectedAc ? <AircraftDetail ac={selectedAc} /> : undefined}
        />
        {/* Range rings decorative overlay */}
        <div className="adsb-range-rings" aria-hidden>
          <div className="adsb-range-ring" />
          <div className="adsb-range-ring" />
          <div className="adsb-range-ring" />
        </div>
      </div>
    </AppScreen>
  );
}
