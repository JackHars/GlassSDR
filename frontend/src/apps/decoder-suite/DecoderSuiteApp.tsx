import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./DecoderSuite.css";

interface OokDecodeEvent {
  protocol: string;
  code_hex: string;
}

interface DecodeFrame {
  id: number;
  protocol: string;
  code_hex: string;
  ts: Date;
  fresh: boolean;
}

let _fid = 0;

interface Lane {
  id: string;
  label: string;
  color: string;
  bg: string;
  description: string;
}

const LANES: Lane[] = [
  { id: "PT2262",   label: "PT2262",   color: "rgba(200,128,40,0.90)",  bg: "rgba(200,128,40,0.14)",  description: "Fixed keyfob/remote" },
  { id: "EV1527",   label: "EV1527",   color: "rgba(50,190,100,0.90)",  bg: "rgba(50,190,100,0.12)",  description: "Learning remote" },
  { id: "Princeton",label: "Princeton", color: "rgba(64,140,220,0.90)",  bg: "rgba(64,140,220,0.12)",  description: "Princeton-based" },
  { id: "CAME",     label: "CAME",     color: "rgba(220,100,40,0.90)",  bg: "rgba(220,100,40,0.12)",  description: "CAME gate remote" },
  { id: "NICE",     label: "NICE",     color: "rgba(30,180,160,0.90)",  bg: "rgba(30,180,160,0.12)",  description: "NICE gate remote" },
  { id: "TPMS",     label: "TPMS",     color: "rgba(220,60,60,0.90)",   bg: "rgba(220,60,60,0.10)",   description: "Tire pressure" },
  { id: "Weather",  label: "Weather",  color: "rgba(60,160,220,0.90)",  bg: "rgba(60,160,220,0.10)",  description: "Weather station" },
  { id: "Generic",  label: "Generic",  color: "rgba(140,120,200,0.90)", bg: "rgba(140,120,200,0.10)", description: "Unknown OOK" },
];

function laneForProtocol(proto: string): Lane {
  return LANES.find((l) => proto.toUpperCase().startsWith(l.id.toUpperCase()))
    ?? LANES[LANES.length - 1]; // fallback to Generic
}

const COMMON_FREQS = [
  { label: "315 MHz",    hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
  { label: "868 MHz",    hz: 868_000_000 },
  { label: "915 MHz",    hz: 915_000_000 },
];

export function DecoderSuiteApp() {
  const [frames, setFrames] = useState<DecodeFrame[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [lnaGain, setLnaGain] = useState(40);
  const [running, setRunning] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(LANES.map((l) => l.id))
  );

  useEffect(() => {
    const p = listen<OokDecodeEvent>("ook_decode", (e) => {
      const { protocol, code_hex } = e.payload;
      const frame: DecodeFrame = {
        id: ++_fid,
        protocol,
        code_hex,
        ts: new Date(),
        fresh: true,
      };
      setFrames((prev) => [frame, ...prev].slice(0, 500));
      setTimeout(() => {
        setFrames((prev) =>
          prev.map((f) => f.id === frame.id ? { ...f, fresh: false } : f)
        );
      }, 600);
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setFrames([]);
    await startApp("decoder_suite" as AppId, {
      center_hz: freqHz,
      lna_gain_db: lnaGain,
      vga_gain_db: 20,
      amp_enabled: false,
    });
    setRunning(true);
  }, [freqHz, lnaGain]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const toggleLane = (id: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const displayed = frames.filter((f) => {
    const lane = laneForProtocol(f.protocol);
    return enabled.has(lane.id);
  });

  // Per-lane count (of all received, not just displayed)
  const counts = new Map<string, number>();
  frames.forEach((f) => {
    const id = laneForProtocol(f.protocol).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  return (
    <AppScreen
      appId="decoder_suite"
      title="Decoder Suite"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz · multi-lane`}
      status={running ? "live" : frames.length > 0 ? "empty" : "idle"}
      statusText={running ? `Decoding · ${displayed.length} frames` : frames.length > 0 ? `${frames.length} total frames` : "Idle"}
    >
      {/* Controls */}
      <div className="dsuite__controls">
        <div className="dsuite__freq-btns">
          {COMMON_FREQS.map((f) => (
            <button key={f.hz}
              className={`dsuite__freq-btn${f.hz === freqHz ? " dsuite__freq-btn--sel" : ""}`}
              onClick={() => setFreqHz(f.hz)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="dsuite__param-row">
          <div className="dsuite__field">
            <label className="dsuite__field-label">LNA {lnaGain} dB</label>
            <input type="range" min={0} max={40} value={lnaGain}
              className="dsuite__slider" onChange={(e) => setLnaGain(+e.target.value)} />
          </div>
          <div className="dsuite__actions">
            <button className={`dsuite__btn dsuite__btn--start${running ? " dsuite__btn--off" : ""}`}
              onClick={handleStart} disabled={running}>▶ Decode</button>
            <button className={`dsuite__btn dsuite__btn--stop${!running ? " dsuite__btn--off" : ""}`}
              onClick={handleStop} disabled={!running}>■ Stop</button>
            <button className="dsuite__btn dsuite__btn--clear" onClick={() => setFrames([])}>Clear</button>
          </div>
        </div>
      </div>

      {/* Lane toggle panel */}
      <GlassPanel title="Decoder Lanes" pad="md" className="dsuite__lanes-panel">
        <div className="dsuite__lanes">
          {LANES.map((lane) => {
            const on = enabled.has(lane.id);
            const cnt = counts.get(lane.id) ?? 0;
            return (
              <button
                key={lane.id}
                className={`dsuite__lane${on ? " dsuite__lane--on" : " dsuite__lane--off"}`}
                style={on ? { borderColor: lane.color, background: lane.bg } : {}}
                onClick={() => toggleLane(lane.id)}
                aria-pressed={on}
              >
                <span className="dsuite__lane-dot"
                  style={{ background: on ? lane.color : "rgba(0,0,0,0.15)" }} />
                <span className="dsuite__lane-label"
                  style={on ? { color: lane.color } : {}}>
                  {lane.label}
                </span>
                {cnt > 0 && (
                  <span className="dsuite__lane-count"
                    style={on ? { color: lane.color } : {}}>
                    {cnt}
                  </span>
                )}
                <span className="dsuite__lane-desc">{lane.description}</span>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Unified decode feed */}
      <GlassPanel
        title={`Unified Feed · ${displayed.length} frames`}
        size="fill"
        pad="none"
        className="dsuite__feed-panel"
      >
        {displayed.length === 0 ? (
          <div className="dsuite__empty">
            {running
              ? "Listening — frames from enabled decoders will appear here"
              : "Press ▶ Decode and transmit an OOK device to see decoded frames"}
          </div>
        ) : (
          <div className="dsuite__feed">
            <div className="dsuite__feed-hdr">
              <span>Layer</span>
              <span>Protocol</span>
              <span>Code</span>
              <span>Time</span>
            </div>
            {displayed.map((f) => {
              const lane = laneForProtocol(f.protocol);
              return (
                <div
                  key={f.id}
                  className={`dsuite__frame-row${f.fresh ? " dsuite__frame-row--fresh" : ""}`}
                  style={f.fresh ? { "--flash-color": lane.bg } as React.CSSProperties : {}}
                >
                  {/* Color tag stripe */}
                  <div className="dsuite__lane-stripe"
                    style={{ background: lane.color }} />
                  <span className="dsuite__row-proto"
                    style={{ color: lane.color, borderColor: lane.color, background: lane.bg }}>
                    {lane.label}
                  </span>
                  <span className="dsuite__row-full-proto">
                    {f.protocol}
                  </span>
                  <span className="dsuite__row-code">{f.code_hex.toUpperCase()}</span>
                  <span className="dsuite__row-time">
                    {f.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"decoder_suite" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
        centerHz={freqHz}
      />
    </AppScreen>
  );
}
