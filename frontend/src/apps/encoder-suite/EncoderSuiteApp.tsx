import { useState } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./EncoderSuite.css";

type Trit = "0" | "1" | "F";
type Tab = "fixed" | "rolling" | "gate";

const TRIT_CYCLE: Record<Trit, Trit> = { "0": "1", "1": "F", "F": "0" };
const TRIT_COUNT = 12;

/** OOK pulse preview for a fixed ternary code */
function OokPulsePreview({ trits }: { trits: Trit[] }) {
  // PT2262 encoding: each trit is 3 symbol widths
  // 0 → short-high short-low  → ▔▔__
  // 1 → long-high  short-low  → ▔▔▔▔__
  // F → short-high long-low   → ▔▔____
  const symbols: { hi: boolean; w: number }[] = [];
  const SYNC_LO = 31;
  trits.forEach((t) => {
    if (t === "0") { symbols.push({ hi: true, w: 1 }); symbols.push({ hi: false, w: 1 }); symbols.push({ hi: true, w: 1 }); symbols.push({ hi: false, w: 3 }); }
    else if (t === "1") { symbols.push({ hi: true, w: 3 }); symbols.push({ hi: false, w: 1 }); symbols.push({ hi: true, w: 1 }); symbols.push({ hi: false, w: 1 }); }
    else { symbols.push({ hi: true, w: 1 }); symbols.push({ hi: false, w: 3 }); symbols.push({ hi: true, w: 1 }); symbols.push({ hi: false, w: 1 }); }
  });
  symbols.push({ hi: false, w: SYNC_LO });

  const total = symbols.reduce((s, sym) => s + sym.w, 0) || 1;
  const W = 480; const H = 32;
  const HIGH_Y = 4; const LOW_Y = 20; const WIRE_H = 10;

  let curX = 0;
  type Seg = { x: number; w: number; hi: boolean };
  const segs: Seg[] = symbols.map((sym) => {
    const w = (sym.w / total) * W;
    const s: Seg = { x: curX, w, hi: sym.hi };
    curX += w;
    return s;
  });

  const pts: [number, number][] = [];
  segs.forEach((seg, i) => {
    const y = seg.hi ? HIGH_Y : LOW_Y;
    if (i === 0) pts.push([0, y]);
    else {
      const prev = segs[i - 1];
      const prevY = prev.hi ? HIGH_Y : LOW_Y;
      if (prevY !== y) { pts.push([seg.x, prevY]); pts.push([seg.x, y]); }
    }
    pts.push([seg.x + seg.w, y]);
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="enc-suite__wave-svg" preserveAspectRatio="none"
      aria-label="OOK pulse preview">
      <rect width={W} height={H} fill="rgba(6,6,16,0.55)" />
      {segs.map((seg, i) => seg.hi && (
        <rect key={i} x={seg.x} y={HIGH_Y} width={seg.w} height={WIRE_H}
          fill="rgba(104,112,168,0.25)" />
      ))}
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none" stroke="rgba(140,148,210,0.88)" strokeWidth={1.4} strokeLinejoin="miter" />
    </svg>
  );
}

// Tab 1: Fixed OOK (PT2262/EV1527)
function FixedTab({
  trits, onTritToggle, protocol, onProtocol, freqHz, onFreq, vgaGain, onVga,
}: {
  trits: Trit[];
  onTritToggle: (i: number) => void;
  protocol: string;
  onProtocol: (p: string) => void;
  freqHz: number;
  onFreq: (hz: number) => void;
  vgaGain: number;
  onVga: (v: number) => void;
}) {
  const code = trits.join("");
  return (
    <div className="enc-suite__tab-body">
      <GlassPanel title="Protocol + Code" pad="md" className="enc-suite__params-panel">
        <div className="enc-suite__field-row">
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Protocol</label>
            <div className="enc-suite__proto-btns">
              {["pt2262", "ev1527"].map((p) => (
                <button key={p}
                  className={`enc-suite__proto-btn${protocol === p ? " enc-suite__proto-btn--sel" : ""}`}
                  onClick={() => onProtocol(p)}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Frequency</label>
            <div className="enc-suite__input-wrap">
              <input className="enc-suite__input" type="number"
                value={freqHz / 1e6} step={0.001}
                onChange={(e) => onFreq(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
              <span className="enc-suite__input-suffix">MHz</span>
            </div>
          </div>
          <div className="enc-suite__field enc-suite__field--gain">
            <label className="enc-suite__field-label">VGA · {vgaGain} dB</label>
            <input type="range" min={0} max={47} value={vgaGain} className="enc-suite__slider"
              onChange={(e) => onVga(+e.target.value)} />
          </div>
        </div>

        {/* 12-trit bit grid */}
        <div className="enc-suite__trit-section">
          <div className="enc-suite__trit-label">
            12-Trit Code <span className="enc-suite__trit-key">(click to cycle 0 → 1 → F)</span>
          </div>
          <div className="enc-suite__trit-grid">
            {trits.map((t, i) => (
              <button key={i}
                className={`enc-suite__trit enc-suite__trit--${t}`}
                onClick={() => onTritToggle(i)}
                aria-label={`Trit ${i}: ${t}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="enc-suite__code-line">
            <span className="enc-suite__code-key">Code</span>
            <span className="enc-suite__code-val">{code}</span>
          </div>
        </div>
      </GlassPanel>

      {/* Pulse preview */}
      <GlassPanel title="OOK Pulse Preview" pad="sm" className="enc-suite__preview-panel">
        <OokPulsePreview trits={trits} />
        <div className="enc-suite__wave-legend">
          {[{ l: "0", d: "Short-Hi Short-Lo" }, { l: "1", d: "Long-Hi Short-Lo" }, { l: "F", d: "Short-Hi Long-Lo" }].map((t) => (
            <span key={t.l} className="enc-suite__wave-item">
              <span className={`enc-suite__wave-dot enc-suite__wave-dot--${t.l}`}>{t.l}</span>
              <span>{t.d}</span>
            </span>
          ))}
        </div>
      </GlassPanel>

      <ArmConsole
        appId={"encoder_suite" as AppId}
        buildParams={() => ({ protocol, code, center_hz: freqHz, vga_gain_db: vgaGain, amp_enabled: false })}
        warning="own-devices-only"
        transmitLabel="ENCODE + TX"
      />
    </div>
  );
}

// Tab 2: Rolling Code (HCS300/KeeLoq)
function RollingTab({ freqHz, onFreq }: { freqHz: number; onFreq: (hz: number) => void }) {
  const [serial, setSerial] = useState("12345678");
  const [button, setButton] = useState("1");
  const [sync, setSync] = useState(0);
  const code = `${serial}_B${button}_S${sync}`;
  return (
    <div className="enc-suite__tab-body">
      <GlassPanel title="Rolling Code Parameters" pad="md" className="enc-suite__params-panel">
        <div className="enc-suite__field-row">
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Serial (hex)</label>
            <input className="enc-suite__input" value={serial} maxLength={8} spellCheck={false}
              onChange={(e) => setSerial(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 8).toUpperCase())} />
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Button (1–4)</label>
            <div className="enc-suite__btn-grid">
              {["1","2","3","4"].map((b) => (
                <button key={b}
                  className={`enc-suite__btn-btn${button === b ? " enc-suite__btn-btn--sel" : ""}`}
                  onClick={() => setButton(b)}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Sync count</label>
            <input className="enc-suite__input enc-suite__input--sm" type="number"
              value={sync} min={0} max={65535}
              onChange={(e) => setSync(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Frequency</label>
            <div className="enc-suite__input-wrap">
              <input className="enc-suite__input" type="number" value={freqHz / 1e6} step={0.001}
                onChange={(e) => onFreq(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
              <span className="enc-suite__input-suffix">MHz</span>
            </div>
          </div>
        </div>
        <div className="enc-suite__code-line enc-suite__code-line--rolling">
          <span className="enc-suite__code-key">Encoded</span>
          <span className="enc-suite__code-val">{serial} · B{button} · S{sync}</span>
        </div>
      </GlassPanel>
      <ArmConsole
        appId={"encoder_suite" as AppId}
        buildParams={() => ({ protocol: "hcs300", code, center_hz: freqHz, vga_gain_db: 30, amp_enabled: false })}
        warning="own-devices-only"
        transmitLabel="ENCODE + TX"
      />
    </div>
  );
}

// Tab 3: Gate Remote (CAME/NICE)
function GateTab({ freqHz, onFreq }: { freqHz: number; onFreq: (hz: number) => void }) {
  const [gateProto, setGateProto] = useState("came");
  const [gateCode, setGateCode] = useState("12345");
  return (
    <div className="enc-suite__tab-body">
      <GlassPanel title="Gate Remote Code" pad="md" className="enc-suite__params-panel">
        <div className="enc-suite__field-row">
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Brand</label>
            <div className="enc-suite__proto-btns">
              {["came", "nice"].map((p) => (
                <button key={p}
                  className={`enc-suite__proto-btn${gateProto === p ? " enc-suite__proto-btn--sel" : ""}`}
                  onClick={() => setGateProto(p)}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Gate Code (decimal)</label>
            <input className="enc-suite__input" type="number" value={gateCode}
              onChange={(e) => setGateCode(e.target.value)} />
          </div>
          <div className="enc-suite__field">
            <label className="enc-suite__field-label">Frequency</label>
            <div className="enc-suite__input-wrap">
              <input className="enc-suite__input" type="number" value={freqHz / 1e6} step={0.001}
                onChange={(e) => onFreq(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
              <span className="enc-suite__input-suffix">MHz</span>
            </div>
          </div>
        </div>
        <div className="enc-suite__code-line">
          <span className="enc-suite__code-key">Code</span>
          <span className="enc-suite__code-val">{gateProto.toUpperCase()} {gateCode}</span>
        </div>
      </GlassPanel>
      <ArmConsole
        appId={"encoder_suite" as AppId}
        buildParams={() => ({ protocol: gateProto, code: gateCode, center_hz: freqHz, vga_gain_db: 30, amp_enabled: false })}
        warning="own-devices-only"
        transmitLabel="ENCODE + TX"
      />
    </div>
  );
}

export function EncoderSuiteApp() {
  const [activeTab, setActiveTab] = useState<Tab>("fixed");
  const [trits, setTrits] = useState<Trit[]>(Array(TRIT_COUNT).fill("0") as Trit[]);
  const [protocol, setProtocol] = useState("pt2262");
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [vgaGain, setVgaGain] = useState(30);

  const toggleTrit = (i: number) =>
    setTrits((prev) => { const next = [...prev]; next[i] = TRIT_CYCLE[prev[i]]; return next as Trit[]; });

  const TABS: { id: Tab; label: string; sub: string }[] = [
    { id: "fixed",   label: "Fixed OOK",     sub: "PT2262 / EV1527" },
    { id: "rolling", label: "Rolling Code",   sub: "HCS300 / KeeLoq" },
    { id: "gate",    label: "Gate Remote",    sub: "CAME / NICE" },
  ];

  return (
    <AppScreen
      appId="encoder_suite"
      title="Encoder Suite"
      subtitle="Multi-protocol OOK"
      status="idle"
      statusText="Disarmed"
    >
      {/* Tab selector */}
      <div className="enc-suite__tabs">
        {TABS.map((t) => (
          <button key={t.id}
            className={`enc-suite__tab${activeTab === t.id ? " enc-suite__tab--sel" : ""}`}
            onClick={() => setActiveTab(t.id)}>
            <span className="enc-suite__tab-label">{t.label}</span>
            <span className="enc-suite__tab-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {activeTab === "fixed" && (
        <FixedTab trits={trits} onTritToggle={toggleTrit} protocol={protocol}
          onProtocol={setProtocol} freqHz={freqHz} onFreq={setFreqHz}
          vgaGain={vgaGain} onVga={setVgaGain} />
      )}
      {activeTab === "rolling" && (
        <RollingTab freqHz={freqHz} onFreq={setFreqHz} />
      )}
      {activeTab === "gate" && (
        <GateTab freqHz={freqHz} onFreq={setFreqHz} />
      )}

      <RecordBar
        appId={"encoder_suite" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freqHz}
      />
    </AppScreen>
  );
}
