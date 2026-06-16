import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./LgeTx.css";

const ISM_FREQS = [
  { label: "315 MHz",    hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
];

interface CmdPreset {
  label: string;
  cmd: number;
  group: "power" | "mode" | "fan" | "other";
}

const CMD_PRESETS: CmdPreset[] = [
  { label: "Power",  cmd: 0x00, group: "power" },
  { label: "Cool",   cmd: 0x01, group: "mode"  },
  { label: "Heat",   cmd: 0x02, group: "mode"  },
  { label: "Dry",    cmd: 0x03, group: "mode"  },
  { label: "Auto",   cmd: 0x04, group: "mode"  },
  { label: "Fan",    cmd: 0x05, group: "mode"  },
  { label: "Low",    cmd: 0x10, group: "fan"   },
  { label: "Med",    cmd: 0x11, group: "fan"   },
  { label: "High",   cmd: 0x12, group: "fan"   },
  { label: "Quiet",  cmd: 0x13, group: "fan"   },
  { label: "Sleep",  cmd: 0x20, group: "other" },
  { label: "Timer",  cmd: 0x21, group: "other" },
];

/** SVG house + antenna motif — the gateway/appliance visual. */
function HouseAntenna() {
  return (
    <svg viewBox="0 0 120 100" className="lge-tx__house-svg" aria-hidden="true">
      {/* House body */}
      <rect x={30} y={52} width={60} height={42} rx={2}
        fill="rgba(200,64,32,0.10)"
        stroke="rgba(200,64,32,0.30)"
        strokeWidth={1.5}
      />
      {/* Roof */}
      <polygon
        points="24,54 60,22 96,54"
        fill="rgba(200,64,32,0.14)"
        stroke="rgba(200,64,32,0.35)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Door */}
      <rect x={50} y={72} width={20} height={22} rx={2}
        fill="rgba(200,64,32,0.20)"
        stroke="rgba(200,64,32,0.28)"
        strokeWidth={1}
      />
      {/* Window */}
      <rect x={36} y={60} width={14} height={12} rx={1}
        fill="rgba(200,64,32,0.18)"
        stroke="rgba(200,64,32,0.28)"
        strokeWidth={0.8}
      />
      <rect x={70} y={60} width={14} height={12} rx={1}
        fill="rgba(200,64,32,0.18)"
        stroke="rgba(200,64,32,0.28)"
        strokeWidth={0.8}
      />
      {/* Antenna on roof */}
      <line x1={60} y1={22} x2={60} y2={6}
        stroke="rgba(200,64,32,0.55)" strokeWidth={1.5}
      />
      <line x1={52} y1={10} x2={68} y2={10}
        stroke="rgba(200,64,32,0.45)" strokeWidth={1}
      />
      <line x1={55} y1={13} x2={65} y2={13}
        stroke="rgba(200,64,32,0.35)" strokeWidth={0.8}
      />
      {/* RF waves radiating from house */}
      {[1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${60 + 10 + i * 8} 50 Q ${60 + 16 + i * 8} 42 ${60 + 10 + i * 8} 34`}
          fill="none"
          stroke={`rgba(200,64,32,${0.45 - i * 0.10})`}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      ))}
      {/* Label */}
      <text x={60} y={99} className="lge-tx__house-label" textAnchor="middle">
        LGE DEVICE
      </text>
    </svg>
  );
}

export function LgeTxApp() {
  const [freqIdx, setFreqIdx] = useState(1); // default 433.92 MHz
  const [deviceAddrHex, setDeviceAddrHex] = useState("01");
  const [selectedCmd, setSelectedCmd] = useState<number>(0x00);
  const [customCmdHex, setCustomCmdHex] = useState("00");
  const [useCustom, setUseCustom] = useState(false);
  const [vgaGain, setVgaGain] = useState(20);

  const freq = ISM_FREQS[freqIdx];
  const deviceAddr = (parseInt(deviceAddrHex, 16) & 0xff) || 1;
  const command = useCustom
    ? (parseInt(customCmdHex, 16) & 0xff)
    : selectedCmd;

  return (
    <AppScreen
      appId="lge_tx"
      title="LGE Device TX"
      subtitle={`${freq.label} · appliance`}
      status="idle"
      statusText="Disarmed"
    >
      {/* Frequency selector */}
      <div className="lge-tx__freq-row">
        {ISM_FREQS.map((f, i) => (
          <button
            key={f.hz}
            className={`lge-tx__freq-btn${i === freqIdx ? " lge-tx__freq-btn--sel" : ""}`}
            onClick={() => setFreqIdx(i)}
            aria-pressed={i === freqIdx}
          >
            {f.label}
          </button>
        ))}
        <span className="lge-tx__protocol-badge">OOK · ASK</span>
      </div>

      <div className="lge-tx__layout">
        {/* Left — command pad hero */}
        <GlassPanel title="Command Pad" size="fill" pad="md" className="lge-tx__cmd-panel">
          {/* Group labels */}
          {(["power", "mode", "fan", "other"] as const).map((group) => {
            const cmds = CMD_PRESETS.filter((c) => c.group === group);
            return (
              <div key={group} className="lge-tx__cmd-group">
                <span className="lge-tx__cmd-group-label">{group.toUpperCase()}</span>
                <div className="lge-tx__cmd-grid">
                  {cmds.map((c) => (
                    <button
                      key={c.cmd}
                      className={`lge-tx__cmd-btn lge-tx__cmd-btn--${group}${
                        !useCustom && selectedCmd === c.cmd ? " lge-tx__cmd-btn--sel" : ""
                      }`}
                      onClick={() => {
                        setSelectedCmd(c.cmd);
                        setUseCustom(false);
                      }}
                      aria-pressed={!useCustom && selectedCmd === c.cmd}
                    >
                      <span className="lge-tx__cmd-name">{c.label}</span>
                      <span className="lge-tx__cmd-hex">
                        {c.cmd.toString(16).toUpperCase().padStart(2, "0")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom command */}
          <div className="lge-tx__custom-row">
            <button
              className={`lge-tx__custom-toggle${useCustom ? " lge-tx__custom-toggle--sel" : ""}`}
              onClick={() => setUseCustom(true)}
            >
              Custom
            </button>
            <div className="lge-tx__custom-input-wrap">
              <span className="lge-tx__custom-prefix">0x</span>
              <input
                className="lge-tx__custom-input"
                value={customCmdHex}
                maxLength={2}
                placeholder="FF"
                spellCheck={false}
                onChange={(e) => {
                  setCustomCmdHex(
                    e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2)
                  );
                  setUseCustom(true);
                }}
              />
            </div>
          </div>
        </GlassPanel>

        {/* Right — device + house motif */}
        <GlassPanel title="Device Config" size="fill" pad="md" className="lge-tx__device-panel">
          <div className="lge-tx__device-stack">
            <div className="lge-tx__field">
              <label className="lge-tx__field-label">Device Address</label>
              <div className="lge-tx__input-wrap">
                <span className="lge-tx__input-prefix">0x</span>
                <input
                  className="lge-tx__input"
                  value={deviceAddrHex}
                  maxLength={2}
                  placeholder="01"
                  spellCheck={false}
                  onChange={(e) =>
                    setDeviceAddrHex(
                      e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2)
                    )
                  }
                />
              </div>
            </div>

            {/* Packet summary */}
            <div className="lge-tx__pkt-summary">
              <div className="lge-tx__pkt-row">
                <span className="lge-tx__pkt-key">ADDR</span>
                <span className="lge-tx__pkt-val">
                  0x{deviceAddr.toString(16).toUpperCase().padStart(2, "0")}
                </span>
              </div>
              <div className="lge-tx__pkt-row">
                <span className="lge-tx__pkt-key">CMD</span>
                <span className="lge-tx__pkt-val">
                  0x{command.toString(16).toUpperCase().padStart(2, "0")}
                </span>
                <span className="lge-tx__pkt-name">
                  {useCustom ? "custom" : (CMD_PRESETS.find((c) => c.cmd === command)?.label ?? "—")}
                </span>
              </div>
              <div className="lge-tx__pkt-row">
                <span className="lge-tx__pkt-key">FREQ</span>
                <span className="lge-tx__pkt-val">
                  {(freq.hz / 1e6).toFixed(3)} MHz
                </span>
              </div>
            </div>

            {/* House/antenna motif */}
            <HouseAntenna />

            <div className="lge-tx__field">
              <label className="lge-tx__field-label">TX VGA · {vgaGain} dB</label>
              <input
                type="range"
                className="lge-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="lge_tx"
        buildParams={() => ({
          center_hz: freq.hz,
          device_addr: deviceAddr,
          command,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"lge_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freq.hz}
      />
    </AppScreen>
  );
}
