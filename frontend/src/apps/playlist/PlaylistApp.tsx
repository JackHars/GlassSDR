import { useState, useRef } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface Step { appId: string; durationSec: number; }

const APPS: string[] = [
  "nfm_audio", "wfm_rx", "am_rx", "adsb_rx", "aprs_rx",
  "ais_rx", "pocsag_rx", "rds_rx", "acars_rx",
];

const LS_KEY = "mayhem_playlist";

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
    <AppShell
      title="TX Playlist"
      status={
        playing && curIdx !== null
          ? <><span style={{color: "#34C759"}}>●</span> Playing step {curIdx + 1}/{steps.length} · {steps[curIdx].appId}</>
          : <><span style={{color: "#999"}}>○</span> Idle · {steps.length} step{steps.length === 1 ? "" : "s"}</>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={play} disabled={playing || steps.length === 0}>▶ Play</button>
              <button className="glass-btn" onClick={stop} disabled={!playing}>■ Stop</button>
            </>
          }
        >
          <ControlField label="App" size="md">
            <select value={newApp} onChange={(e) => setNewApp(e.target.value)}>
              {APPS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </ControlField>
          <ControlField label="Duration (s)" size="sm">
            <input type="number" min={1} max={3600} value={newDur} onChange={(e) => setNewDur(Number(e.target.value))} />
          </ControlField>
          <button className="glass-btn" onClick={add}>Add step</button>
        </ControlRow>
      }
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", minHeight: 200 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.85)", textAlign: "left", backdropFilter: "blur(8px)" }}>
              <th style={{ padding: "8px 12px", width: 40, fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>#</th>
              <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>App</th>
              <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Duration</th>
              <th style={{ padding: "8px 12px", width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: curIdx === i ? "rgba(0,122,255,0.08)" : "transparent" }}>
                <td style={{ padding: "6px 12px", color: "var(--text-tertiary)" }}>{i + 1}</td>
                <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: curIdx === i ? "var(--accent)" : "var(--text-primary)" }}>{s.appId}</td>
                <td style={{ padding: "6px 12px" }}>{s.durationSec}s</td>
                <td style={{ padding: "6px 12px", textAlign: "center" }}>
                  <button onClick={() => remove(i)}
                    style={{ background: "transparent", border: "1px solid rgba(255,80,80,0.4)", color: "#ff8080", borderRadius: 4, cursor: "pointer", fontSize: 11, padding: "1px 6px" }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {steps.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
                No steps yet — pick an app and duration above and tap Add.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
