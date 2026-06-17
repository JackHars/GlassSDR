import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./OokDecoders.css";

interface OokDecodeEvent {
  protocol: string;
  code_hex: string;
}

interface DecodedFrame {
  id: number;
  protocol: string;
  code_hex: string;
  ts: number;
  count: number;
  fresh: boolean;
}

let _frameId = 0;

const PROTOCOL_COLORS: Record<string, string> = {
  PT2262:    "rgba(200,128,40,0.85)",
  EV1527:    "rgba(50,190,100,0.85)",
  Princeton: "rgba(64,140,220,0.85)",
  ManchEV:   "rgba(200,80,160,0.85)",
};

function protocolColor(proto: string): string {
  return PROTOCOL_COLORS[proto] ?? "rgba(104,88,168,0.75)";
}

const COMMON_FREQS = [
  { label: "315 MHz",    hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
  { label: "868 MHz",    hz: 868_000_000 },
  { label: "915 MHz",    hz: 915_000_000 },
];

export function OokDecodersApp() {
  const [frames, setFrames] = useState<DecodedFrame[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [lnaGain, setLnaGain] = useState(40);
  const [running, setRunning] = useState(false);
  const [protocolFilter, setProtocolFilter] = useState<string>("auto");
  const protoCounts = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const p = listen<OokDecodeEvent>("ook_decode", (e) => {
      const { protocol, code_hex } = e.payload;
      const key = `${protocol}:${code_hex}`;
      protoCounts.current.set(protocol, (protoCounts.current.get(protocol) ?? 0) + 1);

      setFrames((prev) => {
        const existing = prev.findIndex((f) => `${f.protocol}:${f.code_hex}` === key);
        if (existing !== -1) {
          const next = [...prev];
          const updated = { ...next[existing], count: next[existing].count + 1, ts: Date.now(), fresh: true };
          next.splice(existing, 1);
          return [updated, ...next].slice(0, 200);
        }
        return [
          { id: ++_frameId, protocol, code_hex, ts: Date.now(), count: 1, fresh: true },
          ...prev,
        ].slice(0, 200);
      });

      setTimeout(() => {
        setFrames((prev) =>
          prev.map((f) => `${f.protocol}:${f.code_hex}` === key ? { ...f, fresh: false } : f)
        );
      }, 600);
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setFrames([]);
    protoCounts.current.clear();
    await startApp("ook_decoders" as AppId, {
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

  const seenProtocols = [...new Set(frames.map((f) => f.protocol))];
  const displayed = protocolFilter === "auto" ? frames : frames.filter((f) => f.protocol === protocolFilter);
  const uniqueCodes = new Set(frames.map((f) => f.code_hex)).size;

  return (
    <AppScreen
      appId="ook_decoders"
      title="OOK Decoders"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz`}
      status={running ? "live" : frames.length > 0 ? "empty" : "idle"}
      statusText={running ? `Decoding · ${frames.length} frames` : frames.length > 0 ? `${frames.length} frames · ${uniqueCodes} unique` : "Idle"}
    >
      {/* Controls */}
      <div className="ook-dc__controls">
        <div className="ook-dc__freq-btns">
          {COMMON_FREQS.map((f) => (
            <button key={f.hz}
              className={`ook-dc__freq-btn${f.hz === freqHz ? " ook-dc__freq-btn--sel" : ""}`}
              onClick={() => setFreqHz(f.hz)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ook-dc__param-row">
          <div className="ook-dc__field">
            <label className="ook-dc__field-label">LNA {lnaGain} dB</label>
            <input type="range" min={0} max={40} value={lnaGain}
              className="ook-dc__slider" onChange={(e) => setLnaGain(+e.target.value)} />
          </div>
          <div className="ook-dc__actions">
            <button className={`ook-dc__btn ook-dc__btn--start${running ? " ook-dc__btn--off" : ""}`}
              onClick={handleStart} disabled={running}>▶ Start</button>
            <button className={`ook-dc__btn ook-dc__btn--stop${!running ? " ook-dc__btn--off" : ""}`}
              onClick={handleStop} disabled={!running}>■ Stop</button>
            <button className="ook-dc__btn ook-dc__btn--clear"
              onClick={() => { setFrames([]); protoCounts.current.clear(); }}>Clear</button>
          </div>
        </div>
      </div>

      {/* Protocol filter */}
      <div className="ook-dc__filter-row">
        <span className="ook-dc__filter-label">Filter</span>
        <button className={`ook-dc__filter-btn${protocolFilter === "auto" ? " ook-dc__filter-btn--sel" : ""}`}
          onClick={() => setProtocolFilter("auto")}>
          Auto-detect
        </button>
        {seenProtocols.map((proto) => (
          <button key={proto}
            className={`ook-dc__filter-btn${protocolFilter === proto ? " ook-dc__filter-btn--sel" : ""}`}
            style={protocolFilter === proto ? { borderColor: protocolColor(proto), color: protocolColor(proto) } : {}}
            onClick={() => setProtocolFilter(proto)}>
            <span className="ook-dc__proto-dot" style={{ background: protocolColor(proto) }} />
            {proto}
            <span className="ook-dc__filter-count">{frames.filter(f => f.protocol === proto).length}</span>
          </button>
        ))}
      </div>

      {/* Decoded frames feed */}
      <GlassPanel title={`Decoded Frames · ${displayed.length}`} size="fill" pad="none"
        className="ook-dc__feed-panel">
        {displayed.length === 0 ? (
          <div className="ook-dc__empty">
            {running
              ? "Listening for PT2262 / EV1527 / Princeton OOK frames…"
              : "Press ▶ Start then activate an OOK remote"}
          </div>
        ) : (
          <div className="ook-dc__feed">
            <div className="ook-dc__feed-hdr">
              <span>Protocol</span>
              <span>Code</span>
              <span>Hits</span>
              <span>Time</span>
            </div>
            {displayed.map((f) => (
              <div key={f.id} className={`ook-dc__frame-row${f.fresh ? " ook-dc__frame-row--fresh" : ""}`}>
                <span className="ook-dc__proto-badge"
                  style={{ color: protocolColor(f.protocol), borderColor: protocolColor(f.protocol) }}>
                  {f.protocol}
                </span>
                <span className="ook-dc__code">{f.code_hex.toUpperCase()}</span>
                <span className="ook-dc__hits">{f.count}</span>
                <span className="ook-dc__time">
                  {new Date(f.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Stats strip */}
      {frames.length > 0 && (
        <div className="ook-dc__stats-bar">
          <span className="ook-dc__stat-item">
            <span className="ook-dc__stat-k">Frames</span>
            <span className="ook-dc__stat-v">{frames.length}</span>
          </span>
          <span className="ook-dc__stat-sep">·</span>
          <span className="ook-dc__stat-item">
            <span className="ook-dc__stat-k">Unique codes</span>
            <span className="ook-dc__stat-v">{uniqueCodes}</span>
          </span>
          {seenProtocols.map((proto) => (
            <span key={proto} className="ook-dc__stat-item">
              <span className="ook-dc__stat-k">{proto}</span>
              <span className="ook-dc__stat-v" style={{ color: protocolColor(proto) }}>
                {frames.filter((f) => f.protocol === proto).length}
              </span>
            </span>
          ))}
        </div>
      )}

      <RecordBar appId={"ook_decoders" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl" centerHz={freqHz} />
    </AppScreen>
  );
}
