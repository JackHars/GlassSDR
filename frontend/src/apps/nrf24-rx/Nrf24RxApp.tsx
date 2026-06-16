import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./Nrf24Rx.css";

interface OokDecodeEvent {
  protocol: string;
  code_hex: string;
}

interface CapturedPacket {
  id: number;
  protocol: string;
  address: string;
  channel: number;
  payload: string;
  ts: Date;
}

let _pktId = 0;

// Mirrors nrf24_tx channel map layout
const CH_COUNT = 126;
const WIFI_ZONES = [
  { lo: 1,  hi: 23, name: "WiFi 1" },
  { lo: 26, hi: 48, name: "WiFi 6" },
  { lo: 51, hi: 73, name: "WiFi 11" },
];

const SVG_W = 480;
const SVG_H = 56;
const PAD_X = 6;
const AXIS_Y = SVG_H - 12;
const CELL_W = (SVG_W - 2 * PAD_X) / CH_COUNT;
const BAR_MAX = AXIS_Y - 14;

function toX(ch: number) {
  return PAD_X + ch * CELL_W + CELL_W / 2;
}

function ChannelActivityStrip({
  selectedCh,
  hitMap,
  maxHits,
}: {
  selectedCh: number;
  hitMap: Map<number, number>;
  maxHits: number;
}) {
  const axisMarks = [0, 25, 50, 75, 100, 125];

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="nrf-rx__strip-svg"
      aria-label="nRF24 2.4 GHz channel activity" preserveAspectRatio="none">
      <rect x={PAD_X} y={10} width={SVG_W - 2 * PAD_X} height={AXIS_Y - 10}
        fill="rgba(8,14,38,0.50)" rx={2} />

      {/* WiFi zones */}
      {WIFI_ZONES.map((z) => (
        <g key={z.name}>
          <rect x={PAD_X + z.lo * CELL_W} y={10}
            width={(z.hi - z.lo) * CELL_W} height={AXIS_Y - 10}
            fill="rgba(255,140,0,0.10)" />
          <text x={PAD_X + ((z.lo + z.hi) / 2) * CELL_W} y={9}
            className="nrf-rx__zone-label" textAnchor="middle">
            {z.name}
          </text>
        </g>
      ))}

      {/* Axis */}
      <line x1={PAD_X} y1={AXIS_Y} x2={SVG_W - PAD_X} y2={AXIS_Y}
        stroke="rgba(32,96,200,0.25)" strokeWidth={0.7} />

      {/* Channel bars — activity height */}
      {Array.from({ length: CH_COUNT }, (_, ch) => {
        const hits = hitMap.get(ch) ?? 0;
        const barH = maxHits > 0 ? (hits / maxHits) * BAR_MAX : 0;
        const isSel = ch === selectedCh;
        return (
          <rect key={ch}
            x={PAD_X + ch * CELL_W + 0.3}
            y={isSel ? 14 : Math.max(14, AXIS_Y - barH)}
            width={Math.max(CELL_W - 0.6, 0.8)}
            height={isSel ? AXIS_Y - 14 : Math.max(2, barH)}
            fill={isSel ? "#2060C8" : hits > 0 ? "rgba(32,96,200,0.65)" : "rgba(32,96,200,0.18)"}
            rx={0.5}
          />
        );
      })}

      {/* Selected channel callout */}
      <text x={Math.min(Math.max(toX(selectedCh), 20), SVG_W - 20)} y={12}
        className="nrf-rx__sel-label" textAnchor="middle">
        CH {selectedCh}
      </text>

      {/* Axis labels */}
      {axisMarks.map((ch) => (
        <text key={ch} x={toX(ch)} y={SVG_H - 1}
          className="nrf-rx__axis-label" textAnchor="middle">
          {ch}
        </text>
      ))}
    </svg>
  );
}

export function Nrf24RxApp() {
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const [channel, setChannel] = useState(76);
  const [address, setAddress] = useState("E7E7E7E7E7");
  const [running, setRunning] = useState(false);
  const hitMapRef = useRef<Map<number, number>>(new Map());
  const [hitMap, setHitMap] = useState<Map<number, number>>(new Map());
  const [maxHits, setMaxHits] = useState(1);
  const channelRef = useRef(channel);
  useEffect(() => { channelRef.current = channel; }, [channel]);
  const addressRef = useRef(address);
  useEffect(() => { addressRef.current = address; }, [address]);

  useEffect(() => {
    const p = listen<OokDecodeEvent>("ook_decode", (e) => {
      const ch = channelRef.current;
      const pkt: CapturedPacket = {
        id: ++_pktId,
        protocol: e.payload.protocol,
        address: addressRef.current,
        channel: ch,
        payload: e.payload.code_hex,
        ts: new Date(),
      };
      setPackets((prev) => [pkt, ...prev].slice(0, 300));

      // Update channel hit map
      const hits = (hitMapRef.current.get(ch) ?? 0) + 1;
      hitMapRef.current.set(ch, hits);
      const newMax = Math.max(...hitMapRef.current.values());
      setMaxHits(newMax);
      setHitMap(new Map(hitMapRef.current));
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setPackets([]);
    hitMapRef.current.clear();
    setHitMap(new Map());
    setMaxHits(1);
    await startApp("nrf24_rx" as AppId, {
      channel,
      address,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });
    setRunning(true);
  }, [channel, address]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const freqMhz = 2400 + channel;

  return (
    <AppScreen
      appId="nrf24_rx"
      title="nRF24 Sniffer"
      subtitle={`CH ${channel} · ${freqMhz} MHz · ESB`}
      status={running ? "live" : packets.length > 0 ? "empty" : "idle"}
      statusText={running ? `Sniffing · ${packets.length} packets` : packets.length > 0 ? `${packets.length} packets` : "Idle"}
    >
      {/* Controls */}
      <div className="nrf-rx__controls">
        <div className="nrf-rx__field">
          <label className="nrf-rx__field-label">Channel (0–125)</label>
          <div className="nrf-rx__ch-row">
            <button className="nrf-rx__step-btn"
              onClick={() => setChannel((c) => Math.max(0, c - 1))}>−</button>
            <input className="nrf-rx__ch-input" type="number" value={channel}
              min={0} max={125}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setChannel(Math.max(0, Math.min(125, v)));
              }} />
            <button className="nrf-rx__step-btn"
              onClick={() => setChannel((c) => Math.min(125, c + 1))}>+</button>
            <span className="nrf-rx__freq-badge">{freqMhz} MHz</span>
          </div>
        </div>

        <div className="nrf-rx__field nrf-rx__field--addr">
          <label className="nrf-rx__field-label">Address (5-byte hex)</label>
          <div className="nrf-rx__addr-wrap">
            <input className="nrf-rx__addr-input" type="text" value={address}
              maxLength={10} placeholder="E7E7E7E7E7" spellCheck={false}
              onChange={(e) => setAddress(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 10).toUpperCase())} />
          </div>
        </div>

        <div className="nrf-rx__actions">
          <button className={`nrf-rx__btn nrf-rx__btn--start${running ? " nrf-rx__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Sniff</button>
          <button className={`nrf-rx__btn nrf-rx__btn--stop${!running ? " nrf-rx__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
          <button className="nrf-rx__btn nrf-rx__btn--clear" onClick={() => {
            setPackets([]); hitMapRef.current.clear(); setHitMap(new Map()); setMaxHits(1);
          }}>Clear</button>
        </div>
      </div>

      {/* Channel activity strip hero */}
      <GlassPanel title="2.4 GHz Channel Activity" pad="sm" className="nrf-rx__strip-panel">
        <ChannelActivityStrip selectedCh={channel} hitMap={hitMap} maxHits={maxHits} />
        <div className="nrf-rx__strip-legend">
          <span className="nrf-rx__legend-item">
            <span className="nrf-rx__legend-dot nrf-rx__legend-dot--sel" />
            Sniff channel (CH {channel})
          </span>
          <span className="nrf-rx__legend-item">
            <span className="nrf-rx__legend-dot nrf-rx__legend-dot--hit" />
            Packet activity
          </span>
          <span className="nrf-rx__legend-item nrf-rx__legend-item--wifi">
            WiFi overlap zones
          </span>
        </div>
      </GlassPanel>

      {/* Packet feed */}
      <GlassPanel title={`Captured Packets · ${packets.length}`} size="fill" pad="none"
        className="nrf-rx__feed-panel">
        {packets.length === 0 ? (
          <div className="nrf-rx__empty">
            {running ? `Sniffing channel ${channel} (${freqMhz} MHz) for ESB frames…` : "Press ▶ Sniff to start"}
          </div>
        ) : (
          <div className="nrf-rx__packet-list">
            <div className="nrf-rx__pkt-hdr">
              <span>Protocol</span>
              <span>Address</span>
              <span>CH</span>
              <span>Payload</span>
              <span>Time</span>
            </div>
            {packets.map((p) => (
              <div key={p.id} className="nrf-rx__pkt-row">
                <span className="nrf-rx__pkt-proto">{p.protocol}</span>
                <span className="nrf-rx__pkt-addr">{p.address}</span>
                <span className="nrf-rx__pkt-ch">{p.channel}</span>
                <span className="nrf-rx__pkt-payload">{p.payload.toUpperCase()}</span>
                <span className="nrf-rx__pkt-time">
                  {p.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <RecordBar appId={"nrf24_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" />
    </AppScreen>
  );
}
