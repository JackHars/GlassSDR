import { useEffect } from "react";
import { AircraftTable } from "../../components/AircraftTable";
import { AircraftMap } from "../../components/AircraftMap";
import { startAdsb, stopApp } from "../../ipc/commands";
import { onAircraftState, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlRow } from "../../components/AppShell";

export function AdsbRxApp() {
  const aircraft = useStore((s) => s.aircraft);
  const upsertAircraft = useStore((s) => s.upsertAircraft);
  const clearAircraft = useStore((s) => s.clearAircraft);
  const status = useStore((s) => s.status);
  const setStatus = useStore((s) => s.setStatus);
  const running = status.kind === "running" || status.kind === "starting";

  useEffect(() => {
    const u1 = onAircraftState(upsertAircraft);
    const u2 = onAppStatus(setStatus);
    return () => { u1.then((f) => f()); u2.then((f) => f()); };
  }, [upsertAircraft, setStatus]);

  return (
    <AppShell
      title="ADS-B Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Tracking {aircraft.size} aircraft</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={() => startAdsb({})} disabled={running}>Start</button>
              <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => clearAircraft()}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Listening on 1090 MHz · Mode S squitter
          </span>
        </ControlRow>
      }
      footer={<RecordBar appId={"adsb_rx" as any} format="jsonl" />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ flex: "2 1 0", minHeight: 200, borderRadius: 12, overflow: "hidden" }}>
          <AircraftMap aircraft={aircraft} />
        </div>
        <div style={{ flex: "1 1 0", minHeight: 120, overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)" }}>
          <AircraftTable aircraft={aircraft} />
        </div>
      </div>
    </AppShell>
  );
}
