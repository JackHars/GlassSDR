import { useState, useRef } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import type { AppId } from "../../ipc/types/AppId";
import "./Playlist.css";

interface Step { appId: string; durationSec: number; }

const AVAILABLE_APPS: string[] = [
  "nfm_audio", "wfm_rx", "am_rx", "usb_rx", "lsb_rx", "cw_rx",
  "adsb_rx", "aprs_rx", "ais_rx", "pocsag_rx", "flex_rx",
  "rds_rx", "acars_rx", "dab_rx", "scanner", "recon",
];

const LS_KEY = "mayhem_playlist";

function loadSteps(): Step[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function appLabel(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PlaylistApp() {
  const [steps, setSteps]   = useState<Step[]>(loadSteps);
  const [newApp, setNewApp] = useState(AVAILABLE_APPS[0]);
  const [newDur, setNewDur] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [curIdx, setCurIdx]  = useState<number | null>(null);
  const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());
  const stopRef              = useRef(false);

  const save = (s: Step[]) => { setSteps(s); localStorage.setItem(LS_KEY, JSON.stringify(s)); };
  const addStep = () => { save([...steps, { appId: newApp, durationSec: newDur }]); };
  const removeStep = (i: number) => save(steps.filter((_, idx) => idx !== i));
  const moveUp = (i: number) => {
    if (i === 0) return;
    const s = [...steps]; [s[i-1], s[i]] = [s[i], s[i-1]]; save(s);
  };
  const moveDown = (i: number) => {
    if (i >= steps.length - 1) return;
    const s = [...steps]; [s[i], s[i+1]] = [s[i+1], s[i]]; save(s);
  };

  const handlePlay = async () => {
    if (playing || steps.length === 0) return;
    setPlaying(true);
    setDoneIdx(new Set());
    stopRef.current = false;

    for (let i = 0; i < steps.length; i++) {
      if (stopRef.current) break;
      setCurIdx(i);
      const step = steps[i];
      try { await startApp(step.appId as AppId, {}); } catch { /* no-op */ }
      await new Promise<void>((res) => {
        const t = setTimeout(res, step.durationSec * 1000);
        const poll = setInterval(() => {
          if (stopRef.current) { clearTimeout(t); clearInterval(poll); res(); }
        }, 100);
      });
      try { await stopApp(); } catch { /* no-op */ }
      setDoneIdx((prev) => new Set(prev).add(i));
    }

    setCurIdx(null);
    setPlaying(false);
  };

  const handleStop = async () => {
    stopRef.current = true;
    try { await stopApp(); } catch { /* no-op */ }
    setCurIdx(null);
    setPlaying(false);
  };

  const totalDur = steps.reduce((acc, s) => acc + s.durationSec, 0);
  const progressPct = playing && curIdx !== null
    ? Math.round((curIdx / steps.length) * 100)
    : 0;

  const appStatus: AppStatus = playing ? "live" : "idle";
  const statusText = playing && curIdx !== null
    ? `Step ${curIdx + 1} / ${steps.length} · ${appLabel(steps[curIdx].appId)}`
    : `${steps.length} step${steps.length !== 1 ? "s" : ""} · ${fmtDur(totalDur)} total`;

  return (
    <AppScreen
      appId="playlist"
      title="TX Playlist"
      subtitle="Sequenced Queue"
      status={appStatus}
      statusText={statusText}
      actions={
        playing ? (
          <button className="pl-btn pl-btn--stop" onClick={handleStop}>■ Stop</button>
        ) : (
          <button className="pl-btn pl-btn--play" onClick={handlePlay} disabled={steps.length === 0}>
            ▶ Run
          </button>
        )
      }
      controls={
        <div className="pl-controls">
          <div className="pl-ctrl-field">
            <label className="pl-ctrl-label">App</label>
            <select
              className="pl-ctrl-select"
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
            >
              {AVAILABLE_APPS.map((a) => <option key={a} value={a}>{appLabel(a)}</option>)}
            </select>
          </div>
          <div className="pl-ctrl-field">
            <label className="pl-ctrl-label">Duration (s)</label>
            <input
              className="pl-ctrl-input"
              type="number"
              min={1}
              max={3600}
              value={newDur}
              onChange={(e) => setNewDur(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <button className="pl-add-btn" onClick={addStep}>+ Add step</button>
        </div>
      }
    >
      <div className="pl-layout">
        {/* Progress indicator during playback */}
        {playing && curIdx !== null && (
          <div className="pl-progress-wrap">
            <div className="pl-progress__track">
              <div className="pl-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="pl-progress__label">
              Running step {curIdx + 1} of {steps.length}
            </span>
          </div>
        )}

        {/* TX caution note */}
        <div className="pl-caution">
          Each TX step uses the respective app's arm gate — check before running.
        </div>

        {/* Step queue */}
        {steps.length === 0 ? (
          <div className="pl-empty">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="10" width="40" height="8" rx="3" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" />
              <rect x="4" y="22" width="30" height="8" rx="3" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.4" />
              <rect x="4" y="34" width="20" height="8" rx="3" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.3" />
              <circle cx="40" cy="38" r="7" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" />
              <path d="M38 38L40 40L43 36" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
            </svg>
            <div className="pl-empty__title">No steps in queue</div>
            <div className="pl-empty__sub">Add a step above to build your playlist.</div>
          </div>
        ) : (
          <GlassPanel title="Queue" titleRight={<span className="pl-queue-total">{fmtDur(totalDur)} total</span>} size="fill" pad="none">
            <div className="pl-queue">
              {steps.map((step, i) => {
                const isActive = curIdx === i;
                const isDone = doneIdx.has(i);
                return (
                  <div
                    key={i}
                    className={`pl-step${isActive ? " pl-step--active" : ""}${isDone ? " pl-step--done" : ""}`}
                  >
                    <div className="pl-step__num">
                      {isDone ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="1.5" />
                          <path d="M5 8L7 10L11 6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : isActive ? (
                        <span className="pl-step__playing-dot" />
                      ) : (
                        <span className="pl-step__idx">{i + 1}</span>
                      )}
                    </div>
                    <div className="pl-step__body">
                      <span className="pl-step__app">{appLabel(step.appId)}</span>
                      <span className="pl-step__appid">{step.appId}</span>
                    </div>
                    <div className="pl-step__dur">{fmtDur(step.durationSec)}</div>
                    <div className="pl-step__actions">
                      <button className="pl-step__move" onClick={() => moveUp(i)} disabled={i === 0 || playing} title="Move up">▴</button>
                      <button className="pl-step__move" onClick={() => moveDown(i)} disabled={i === steps.length - 1 || playing} title="Move down">▾</button>
                      <button className="pl-step__del" onClick={() => removeStep(i)} disabled={playing} title="Remove">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        )}
      </div>
    </AppScreen>
  );
}
