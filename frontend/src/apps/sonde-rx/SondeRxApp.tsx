import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { EntityMap } from "../../components/kit/EntityMap";
import type { MapEntity } from "../../components/kit/EntityMap";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./SondeRx.css";

interface SondeEvent { serial: string; lat: number; lon: number; alt_m: number; sonde_type: string; }

function BalloonDetail({ sonde }: { sonde: SondeEvent }) {
  return (
    <div className="sonde-balloon-detail">
      <div className="sonde-balloon-serial">{sonde.serial}</div>
      <div className="sonde-balloon-type">{sonde.sonde_type}</div>
      <div className="sonde-balloon-stats">
        <div className="sonde-balloon-stat"><span className="sonde-balloon-stat-label">Alt</span><span className="sonde-balloon-stat-value">{sonde.alt_m.toFixed(0)} m</span></div>
        <div className="sonde-balloon-stat"><span className="sonde-balloon-stat-label">Lat</span><span className="sonde-balloon-stat-value">{sonde.lat.toFixed(4)}</span></div>
        <div className="sonde-balloon-stat"><span className="sonde-balloon-stat-label">Lon</span><span className="sonde-balloon-stat-value">{sonde.lon.toFixed(4)}</span></div>
      </div>
    </div>
  );
}

export function SondeRxApp() {
  const [freqHz, setFreqHz] = useState(403_000_000);
  const [frames, setFrames] = useState<SondeEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const p = listen<SondeEvent>("sonde_telemetry", (e) =>
      setFrames((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("sonde_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  // Latest per serial
  const latestPerSerial = useMemo(() => {
    const m = new Map<string, SondeEvent>();
    for (const f of frames) { if (!m.has(f.serial)) m.set(f.serial, f); }
    return m;
  }, [frames]);

  const entities = useMemo<MapEntity[]>(() => {
    const result: MapEntity[] = [];
    latestPerSerial.forEach((s) => {
      result.push({ id: s.serial, lat: s.lat, lon: s.lon, kind: "balloon", label: s.serial });
    });
    return result;
  }, [latestPerSerial]);

  const selectedSonde = selected ? latestPerSerial.get(selected) ?? null : null;
  const newestAlt = frames[0]?.alt_m;
  const appStatus: AppStatus = running ? (frames.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="sonde_rx"
      title="Radiosonde RX"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz`}
      status={appStatus}
      statusText={running ? (frames.length > 0 ? `${frames.length} frames` : "Scanning") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setFrames([]); setSelected(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"sonde_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div className="sonde-layout">
        <div className="sonde-map-col">
          <EntityMap
            entities={entities}
            selected={selected}
            onSelect={setSelected}
            accentColor="#50B8E8"
            emptyLabel="No radiosondes — scanning 400-406 MHz"
            detail={selectedSonde ? <BalloonDetail sonde={selectedSonde} /> : undefined}
          />
        </div>
        <div className="sonde-info-col">
          {newestAlt !== undefined && (
            <div className="sonde-alt-panel">
              <div className="sonde-alt-label">Altitude</div>
              <div className="sonde-alt-value">{newestAlt.toFixed(0)} m</div>
            </div>
          )}
          <div style={{ flex: "1 1 auto", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from(latestPerSerial.values()).map((s) => (
              <div key={s.serial}
                style={{ padding: "8px 10px", background: selected === s.serial ? "var(--accent-dim)" : "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)", border: `1px solid ${selected === s.serial ? "var(--accent)" : "rgba(255,255,255,0.7)"}`, borderRadius: 8, cursor: "pointer" }}
                onClick={() => setSelected(selected === s.serial ? null : s.serial)}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>{s.serial}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{s.sonde_type} · {s.alt_m.toFixed(0)} m</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
