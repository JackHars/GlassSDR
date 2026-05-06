import { useEffect } from "react";
import { AircraftTable } from "../../components/AircraftTable";
import { AircraftMap } from "../../components/AircraftMap";
import { startAdsb, stopApp } from "../../ipc/commands";
import { onAircraftState, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => startAdsb({})} disabled={running}>Start</button>
        <button onClick={() => stopApp()} disabled={!running}>Stop</button>
        <button onClick={() => clearAircraft()}>Clear</button>
        <span style={{ marginLeft: 12, color: "#888" }}>
          Tracking {aircraft.size} aircraft
        </span>
      </div>
      <AircraftMap aircraft={aircraft} />
      <div style={{ overflow: "auto", maxHeight: 240 }}>
        <AircraftTable aircraft={aircraft} />
      </div>
    </div>
  );
}
