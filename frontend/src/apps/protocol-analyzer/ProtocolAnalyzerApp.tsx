import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import "./ProtocolAnalyzer.css";

const PROTOCOL_FAMILIES = [
  { id: "auto", label: "Auto" },
  { id: "ask",  label: "ASK" },
  { id: "fsk",  label: "FSK" },
  { id: "gfsk", label: "GFSK" },
  { id: "psk",  label: "PSK" },
  { id: "lora", label: "LoRa" },
  { id: "mfm",  label: "Manchester" },
];

function fmtHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

// ── Mini Spectrum ─────────────────────────────────────────────────────────────

interface MiniSpectrumProps {
  frame: SpectrumFrame | null;
  running: boolean;
}

function MiniSpectrum({ frame, running }: MiniSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(8, 12, 22, 0.95)";
    ctx.fillRect(0, 0, width, height);

    if (!frame || frame.bins.length === 0 || frame.bins.every((b) => b === 0)) {
      ctx.fillStyle = "rgba(74,111,165,0.3)";
      ctx.font = "10px SF Mono, JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(running ? "acquiring…" : "no signal", width / 2, height / 2 + 4);
      return;
    }

    const bins = frame.bins;
    const barW = width / bins.length;
    for (let i = 0; i < bins.length; i++) {
      const v = bins[i] / 255;
      const h = v * (height - 4);
      ctx.fillStyle = `rgba(74,111,165,${(0.3 + v * 0.7).toFixed(2)})`;
      ctx.fillRect(i * barW, height - h, Math.max(1, barW - 0.5), h);
    }

    // Center line
    ctx.strokeStyle = "rgba(74,111,165,0.45)";
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [frame, running]);

  return (
    <div className="pa-spectrum">
      <canvas ref={canvasRef} className="pa-spectrum__canvas" width={512} height={54} />
      {frame && (
        <div className="pa-spectrum__labels">
          <span>{fmtHz(frame.center_hz - frame.span_hz / 2)}</span>
          <span>{fmtHz(frame.center_hz)}</span>
          <span>{fmtHz(frame.center_hz + frame.span_hz / 2)}</span>
        </div>
      )}
    </div>
  );
}

// ── Hex Dump Pane ─────────────────────────────────────────────────────────────

const BYTES_PER_ROW = 16;

interface HexDumpProps {
  bytes: Uint8Array | null;
  hlStart?: number;
  hlEnd?: number;
}

function HexDump({ bytes, hlStart, hlEnd }: HexDumpProps) {
  if (!bytes || bytes.length === 0) {
    return (
      <div className="pa-empty-pane">
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          <rect x="5" y="5" width="32" height="32" rx="5" stroke="rgba(74,111,165,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="21" y="26" textAnchor="middle" fill="rgba(74,111,165,0.5)" fontSize="14" fontFamily="SF Mono, JetBrains Mono, monospace" fontWeight="600">0x</text>
        </svg>
        <span className="pa-empty-pane__title">No frame captured</span>
        <span className="pa-empty-pane__sub">Press Capture to record a packet</span>
      </div>
    );
  }

  const rows = Math.ceil(bytes.length / BYTES_PER_ROW);
  return (
    <div className="pa-hex">
      <div className="pa-hex__head">
        <span className="pa-hex__head-offset">Offset</span>
        <span className="pa-hex__head-hex">
          {Array.from({ length: BYTES_PER_ROW }, (_, i) =>
            i.toString(16).padStart(2, "0").toUpperCase()
          ).join(" ")}
        </span>
        <span className="pa-hex__head-ascii">ASCII</span>
      </div>
      <div className="pa-hex__rows">
        {Array.from({ length: rows }, (_, r) => {
          const off = r * BYTES_PER_ROW;
          const slice = bytes.slice(off, off + BYTES_PER_ROW);
          return (
            <div className="pa-hex__row" key={r}>
              <span className="pa-hex__off">{off.toString(16).padStart(8, "0")}</span>
              <span className="pa-hex__bytes">
                {Array.from({ length: BYTES_PER_ROW }, (_, i) => {
                  const idx = off + i;
                  const inSlice = i < slice.length;
                  const hl = hlStart !== undefined && hlEnd !== undefined && idx >= hlStart && idx < hlEnd;
                  return (
                    <span key={i} className={`pa-hex__b${!inSlice ? " pa-hex__b--empty" : ""}${hl ? " pa-hex__b--hl" : ""}`}>
                      {inSlice ? slice[i].toString(16).padStart(2, "0").toUpperCase() : "  "}
                    </span>
                  );
                })}
              </span>
              <span className="pa-hex__ascii">
                {Array.from(slice).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·")).join("")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Field Tree Pane ───────────────────────────────────────────────────────────

interface FieldNode {
  name: string;
  value?: string;
  bytes?: [number, number];
  children?: FieldNode[];
}

interface FieldTreeProps {
  tree: FieldNode[] | null;
  onHover: (start: number | null, end: number | null) => void;
}

function renderNode(
  node: FieldNode,
  depth: number,
  onHover: (s: number | null, e: number | null) => void
): JSX.Element {
  return (
    <div
      key={node.name + depth}
      className={`pa-tree__node${node.children ? " pa-tree__node--group" : ""}`}
      style={{ paddingLeft: depth * 14 + 10 }}
      onMouseEnter={() => node.bytes ? onHover(node.bytes[0], node.bytes[1]) : undefined}
      onMouseLeave={() => onHover(null, null)}
    >
      <span className={`pa-tree__marker${node.children ? " pa-tree__marker--branch" : ""}`}>
        {node.children ? "▸" : "·"}
      </span>
      <span className="pa-tree__name">{node.name}</span>
      {node.value !== undefined && <span className="pa-tree__val">{node.value}</span>}
      {node.children?.map((c) => renderNode(c, depth + 1, onHover))}
    </div>
  );
}

function FieldTree({ tree, onHover }: FieldTreeProps) {
  if (!tree || tree.length === 0) {
    return (
      <div className="pa-empty-pane">
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          <circle cx="21" cy="21" r="15" stroke="rgba(74,111,165,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="21" cy="21" r="5.5" stroke="rgba(74,111,165,0.4)" strokeWidth="1" />
          <line x1="21" y1="6" x2="21" y2="36" stroke="rgba(74,111,165,0.2)" strokeWidth="0.75" />
          <line x1="6"  y1="21" x2="36" y2="21" stroke="rgba(74,111,165,0.2)" strokeWidth="0.75" />
        </svg>
        <span className="pa-empty-pane__title">Awaiting dissection</span>
        <span className="pa-empty-pane__sub">Field annotations populate after capture</span>
      </div>
    );
  }
  return (
    <div className="pa-tree">
      {tree.map((n) => renderNode(n, 0, onHover))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ProtocolAnalyzerApp() {
  const [freqHz, setFreqHz]       = useState(433_920_000);
  const [symbolRate, setSymbolRate] = useState(9600);
  const [protocol, setProtocol]   = useState("auto");
  const [running, setRunning]     = useState(false);
  const [spectrum, setSpectrum]   = useState<SpectrumFrame | null>(null);
  const [hlRange, setHlRange]     = useState<[number | null, number | null]>([null, null]);

  useEffect(() => {
    const ul = listen<SpectrumFrame>("spectrum", (e) => setSpectrum(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const handleCapture = async () => {
    await startApp("protocol_analyzer" as AppId, { center_hz: freqHz, symbol_rate: symbolRate });
    setRunning(true);
  };

  const handleStop = async () => {
    await stopApp();
    setRunning(false);
  };

  const appStatus: AppStatus = running ? "acquiring" : "idle";
  const statusText = running
    ? `Capturing · ${fmtHz(freqHz)} · ${symbolRate.toLocaleString()} Bd`
    : `Ready · ${fmtHz(freqHz)}`;

  return (
    <AppScreen
      appId="protocol_analyzer"
      title="Protocol Analyzer"
      subtitle="Packet Dissector"
      status={appStatus}
      statusText={statusText}
      actions={
        running ? (
          <button className="pa-btn pa-btn--stop" onClick={handleStop}>■ Stop</button>
        ) : (
          <button className="pa-btn pa-btn--capture" onClick={handleCapture}>◉ Capture</button>
        )
      }
      controls={
        <div className="pa-controls">
          <div className="pa-ctrl-field">
            <label className="pa-ctrl-label">Frequency</label>
            <input
              className="pa-ctrl-input"
              type="number"
              value={freqHz}
              step={100_000}
              onChange={(e) => setFreqHz(Number(e.target.value))}
            />
          </div>
          <div className="pa-ctrl-field">
            <label className="pa-ctrl-label">Symbol Rate (Bd)</label>
            <input
              className="pa-ctrl-input pa-ctrl-input--sm"
              type="number"
              value={symbolRate}
              step={1200}
              onChange={(e) => setSymbolRate(Number(e.target.value))}
            />
          </div>
          <div className="pa-ctrl-field">
            <label className="pa-ctrl-label">Modulation</label>
            <div className="pa-proto-tabs">
              {PROTOCOL_FAMILIES.map((p) => (
                <button
                  key={p.id}
                  className={`pa-proto-tab${protocol === p.id ? " pa-proto-tab--on" : ""}`}
                  onClick={() => setProtocol(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
      footer={<RecordBar appId={"protocol_analyzer" as AppId} format="iq" centerHz={freqHz} />}
    >
      <div className="pa-layout">
        {/* Mini spectrum */}
        <GlassPanel title="Signal" pad="none" style={{ flexShrink: 0 }}>
          <MiniSpectrum frame={spectrum} running={running} />
        </GlassPanel>

        {/* Packet dissector */}
        <div className="pa-dissector">
          <GlassPanel
            title="Frame Bytes"
            titleRight={<span className="pa-badge">hex · ASCII</span>}
            size="fill"
            pad="none"
          >
            <HexDump
              bytes={null}
              hlStart={hlRange[0] ?? undefined}
              hlEnd={hlRange[1] ?? undefined}
            />
          </GlassPanel>

          <GlassPanel
            title="Field Annotations"
            titleRight={<span className="pa-badge">dissection</span>}
            size="fill"
            pad="none"
          >
            <FieldTree
              tree={null}
              onHover={(s, e) => setHlRange([s, e])}
            />
          </GlassPanel>
        </div>
      </div>
    </AppScreen>
  );
}
