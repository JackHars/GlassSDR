import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { EntityMap } from "../../components/kit/EntityMap";
import type { MapEntity } from "../../components/kit/EntityMap";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AdsbExt.css";

interface AircraftState {
  icao24: string;
  callsign?: string;
  position?: { lat: number; lon: number; altitude_ft?: number };
  velocity?: { ground_speed_kt: number; heading_deg: number; vert_rate_fpm: number };
  last_seen_ms: number;
}

const MAX_TRAIL = 40;
const MAX_ALT = 45_000; // ft

function AltBar({ label, alt }: { label: string; alt: number | null | undefined }) {
  const pct = alt ? Math.min(100, (alt / MAX_ALT) * 100) : 0;
  return (
    <div className="adsb-ext-alt-bar">
      <span style={{ minWidth: 40 }}>{label}</span>
      <div className="adsb-ext-alt-bar__track">
        <div className="adsb-ext-alt-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ minWidth: 50 }}>
        {alt != null ? `${Math.round(alt).toLocaleString()}ft` : "—"}
      </span>
    </div>
  );
}

function ExtDetail({
  ac,
  altHistory,
}: {
  ac: AircraftState;
  altHistory: Array<number | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pts = altHistory.filter((v) => v != null) as number[];
    if (pts.length < 2) return;
    const max = Math.max(...pts, 1000);
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "var(--accent)";
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  }, [altHistory]);

  return (
    <div className="adsb-ext-detail">
      <div className="adsb-ext-detail__callsign">{ac.callsign ?? "——"}</div>
      <div className="adsb-ext-detail__icao">ICAO {ac.icao24.toUpperCase()}</div>
      <div className="adsb-ext-stats">
        <div className="adsb-ext-stat">
          <span className="adsb-ext-stat-label">Speed</span>
          <span className="adsb-ext-stat-value">{ac.velocity ? `${Math.round(ac.velocity.ground_speed_kt)}kt` : "—"}</span>
        </div>
        <div className="adsb-ext-stat">
          <span className="adsb-ext-stat-label">Heading</span>
          <span className="adsb-ext-stat-value">{ac.velocity ? `${Math.round(ac.velocity.heading_deg)}°` : "—"}</span>
        </div>
        <div className="adsb-ext-stat">
          <span className="adsb-ext-stat-label">V/S</span>
          <span className="adsb-ext-stat-value">{ac.velocity ? `${ac.velocity.vert_rate_fpm > 0 ? "+" : ""}${Math.round(ac.velocity.vert_rate_fpm)}fpm` : "—"}</span>
        </div>
        <div className="adsb-ext-stat">
          <span className="adsb-ext-stat-label">Alt</span>
          <span className="adsb-ext-stat-value">{ac.position?.altitude_ft != null ? `${Math.round(ac.position.altitude_ft).toLocaleString()}ft` : "—"}</span>
        </div>
      </div>
      {/* Altitude ladder */}
      <div className="adsb-ext-alt-ladder">
        <span className="adsb-ext-alt-ladder__label">Altitude history</span>
        <AltBar label="Now" alt={ac.position?.altitude_ft} />
        <canvas ref={canvasRef} className="adsb-ext-trail-chart" width={200} height={40} />
      </div>
    </div>
  );
}

export function AdsbExtApp() {
  const [aircraft, setAircraft] = useState<Map<string, AircraftState>>(new Map());
  const [trails, setTrails] = useState<Map<string, Array<{ lat: number; lon: number }>>>(new Map());
  const [altHistories, setAltHistories] = useState<Map<string, Array<number | null>>>(new Map());
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = async () => {
    await startApp("adsb_rx_ext" as AppId, { lna_gain_db: 40, vga_gain_db: 40 });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };
  const handleClear = useCallback(() => { setAircraft(new Map()); setTrails(new Map()); setAltHistories(new Map()); setSelected(null); }, []);

  useEffect(() => {
    const p = listen<AircraftState>("aircraft_state", (e) => {
      const ac = e.payload;
      setAircraft((prev) => { const n = new Map(prev); n.set(ac.icao24, ac); return n; });
      if (ac.position) {
        setTrails((prev) => {
          const n = new Map(prev);
          const trail = (n.get(ac.icao24) ?? []).slice(-MAX_TRAIL);
          trail.push({ lat: ac.position!.lat, lon: ac.position!.lon });
          n.set(ac.icao24, trail);
          return n;
        });
        setAltHistories((prev) => {
          const n = new Map(prev);
          const hist = (n.get(ac.icao24) ?? []).slice(-MAX_TRAIL);
          hist.push(ac.position!.altitude_ft ?? null);
          n.set(ac.icao24, hist);
          return n;
        });
      }
    });
    return () => { p.then((f) => f()); };
  }, []);

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
        trail: trails.get(ac.icao24),
      });
    });
    return result;
  }, [aircraft, trails]);

  const count = aircraft.size;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";
  const selectedAc = selected ? aircraft.get(selected) ?? null : null;
  const selectedAltHistory = selected ? (altHistories.get(selected) ?? []) : [];

  return (
    <AppScreen
      appId="adsb_rx_ext"
      title="ADS-B Extended"
      subtitle="1090 MHz · Extended squitter"
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} tracked` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            Extended squitter · trails + altitude history
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={handleClear} disabled={count === 0}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"adsb_rx_ext" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={1_090_000_000} />
      }
    >
      <div className="adsb-ext-map-wrap">
        <EntityMap
          entities={entities}
          selected={selected}
          onSelect={setSelected}
          accentColor="#0A7A60"
          emptyLabel="No aircraft — start to receive extended squitter"
          detail={selectedAc ? <ExtDetail ac={selectedAc} altHistory={selectedAltHistory} /> : undefined}
        />
        <div className="adsb-ext-rings" aria-hidden>
          <div className="adsb-ext-ring" />
          <div className="adsb-ext-ring" />
          <div className="adsb-ext-ring" />
          <div className="adsb-ext-ring" />
        </div>
      </div>
    </AppScreen>
  );
}
