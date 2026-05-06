import { useMemo, useState } from "react";
import type { AircraftState } from "../ipc/types/AircraftState";

type SortKey = "icao24" | "callsign" | "altitude_ft" | "speed" | "last_seen_ms";

interface Props {
  aircraft: Map<string, AircraftState>;
}

export function AircraftTable({ aircraft }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("last_seen_ms");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const arr = Array.from(aircraft.values());
    arr.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return desc ? -cmp : cmp;
    });
    return arr;
  }, [aircraft, sortKey, desc]);

  const click = (k: SortKey) => () => {
    if (sortKey === k) setDesc((d) => !d);
    else { setSortKey(k); setDesc(true); }
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "100%", color: "#eee", fontSize: 12, fontFamily: "monospace" }}>
      <thead>
        <tr style={{ background: "#1c1c2c" }}>
          <Th onClick={click("icao24")}>ICAO24</Th>
          <Th onClick={click("callsign")}>Callsign</Th>
          <Th onClick={click("altitude_ft")}>Alt (ft)</Th>
          <Th onClick={click("speed")}>Speed (kt)</Th>
          <Th>Heading</Th>
          <Th>Lat</Th>
          <Th>Lon</Th>
          <Th onClick={click("last_seen_ms")}>Last</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.icao24} style={{ borderBottom: "1px solid #333" }}>
            <td>{a.icao24}</td>
            <td>{a.callsign ?? ""}</td>
            <td>{a.position?.altitude_ft ?? ""}</td>
            <td>{a.velocity ? a.velocity.ground_speed_kt.toFixed(0) : ""}</td>
            <td>{a.velocity ? `${a.velocity.heading_deg.toFixed(0)}°` : ""}</td>
            <td>{a.position ? a.position.lat.toFixed(4) : ""}</td>
            <td>{a.position ? a.position.lon.toFixed(4) : ""}</td>
            <td>{ageSeconds(a.last_seen_ms)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function compare(a: AircraftState, b: AircraftState, k: SortKey): number {
  switch (k) {
    case "icao24": return a.icao24.localeCompare(b.icao24);
    case "callsign": return (a.callsign ?? "").localeCompare(b.callsign ?? "");
    case "altitude_ft": return (a.position?.altitude_ft ?? 0) - (b.position?.altitude_ft ?? 0);
    case "speed": return (a.velocity?.ground_speed_kt ?? 0) - (b.velocity?.ground_speed_kt ?? 0);
    case "last_seen_ms": return a.last_seen_ms - b.last_seen_ms;
  }
}

function ageSeconds(ms: number): number {
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      style={{ textAlign: "left", padding: 4, cursor: onClick ? "pointer" : "default", userSelect: "none" }}
    >
      {children}
    </th>
  );
}
