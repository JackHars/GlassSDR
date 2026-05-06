import { useState, useRef } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface Step { appId: string; durationSec: number; }

const APPS: string[] = [
  "nfm_audio", "wfm_rx", "am_rx", "adsb_rx", "aprs_rx",
  "ais_rx", "pocsag_rx", "rds_rx", "acars_rx",
];

const LS_KEY = "mayhem_playlist";
const inp = { background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 6px", borderRadius: 3 };

function loadSteps(): Step[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

export function PlaylistApp() {
  const [steps, setSteps] = useState<Step[]>(loadSteps);
  const [newApp, setNewApp] = useState(APPS[0]);
  const [newDur, setNewDur] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [curIdx, setCurIdx] = useState<number | null>(null);
  const stopRef = useRef(false);

  const save = (s: Step[]) => { setSteps(s); localStorage.setItem(LS_KEY, JSON.stringify(s)); };
  const add = () => { save([...steps, { appId: newApp, durationSec: newDur }]); };
  const remove = (i: number) => save(steps.filter((_, idx) => idx !== i));

  const play = async () => {
    if (playing || steps.length === 0) return;
    setPlaying(true); stopRef.current = false;
    for (let i = 0; i < steps.length; i++) {
      if (stopRef.current) break;
      setCurIdx(i);
      const step = steps[i];
      try { await startApp(step.appId as AppId, {}); } catch { /* app may not need start */ }
      await new Promise<void>((res) => {
        const t = setTimeout(res, step.durationSec * 1000);
        const poll = setInterval(() => { if (stopRef.current) { clearTimeout(t); clearInterval(poll); res(); } }, 100);
      });
      try { await stopApp(); } catch { /* ignore */ }
    }
    setCurIdx(null); setPlaying(false);
  };

  const stop = async () => {
    stopRef.current = true;
    try { await stopApp(); } catch { /* ignore */ }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Playlist</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={newApp} onChange={(e) => setNewApp(e.target.value)} style={inp}>
          {APPS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="number" min={1} max={3600} value={newDur} onChange={(e) => setNewDur(Number(e.target.value))} style={{ ...inp, width: 70 }} />
        <span style={{ alignSelf: "center", color: "#aaa", fontSize: 13 }}>sec</span>
        <button onClick={add} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "4px 12px", cursor: "pointer" }}>Add</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ background: "#222" }}>
            <th style={{ padding: 6, textAlign: "left" }}>#</th>
            <th style={{ padding: 6, textAlign: "left" }}>App</th>
            <th style={{ padding: 6, textAlign: "left" }}>Duration</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #2a2a2a", background: curIdx === i ? "#113" : "transparent" }}>
              <td style={{ padding: "5px 6px", color: "#666" }}>{i + 1}</td>
              <td style={{ padding: "5px 6px" }}>{s.appId}</td>
              <td style={{ padding: "5px 6px" }}>{s.durationSec}s</td>
              <td style={{ padding: "5px 6px", textAlign: "center" }}>
                <button onClick={() => remove(i)} style={{ background: "#500", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer", padding: "2px 8px" }}>✕</button>
              </td>
            </tr>
          ))}
          {steps.length === 0 && <tr><td colSpan={4} style={{ padding: 16, color: "#555", textAlign: "center" }}>No steps</td></tr>}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={play} disabled={playing || steps.length === 0} style={{ background: "#262", color: "#eee", border: "none", borderRadius: 3, padding: "6px 16px", cursor: "pointer" }}>▶ Play</button>
        <button onClick={stop} disabled={!playing} style={{ background: "#555", color: "#eee", border: "none", borderRadius: 3, padding: "6px 16px", cursor: "pointer" }}>■ Stop</button>
      </div>
      {playing && curIdx !== null && (
        <div style={{ marginTop: 8, color: "#8af", fontSize: 13 }}>Playing step {curIdx + 1}: {steps[curIdx].appId}</div>
      )}
    </div>
  );
}
