import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import type { AppId } from "../../ipc/types/AppId";
import { useStore } from "../../store";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

const PROTOCOLS = ["pt2262", "ev1527", "hcs300", "keeloq", "came", "nice"] as const;

export function EncoderSuiteApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [protocol, setProtocol] = useState<string>("pt2262");
  const [code, setCode] = useState("000000000000");
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleTransmit = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await startApp("encoder_suite" as AppId, {
      protocol, code, center_hz: freqHz, vga_gain_db: 30, amp_enabled: false,
    });
  };

  return (
    <AppShell
      title="Encoder Suite"
      status={
        txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle · Multi-protocol OOK encoder</>
      }
      controls={
        <ControlRow
          actions={
            <button className="glass-btn" onClick={handleTransmit} style={{ background: "#FF3B30", color: "#fff", fontWeight: 700 }}>TRANSMIT</button>
          }
        >
          <ControlField label="Protocol" size="md">
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              {PROTOCOLS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </ControlField>
          <ControlField label="Code" size="lg">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Bit pattern or hex code" />
          </ControlField>
          <ControlField label="Frequency (Hz)" size="md">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"encoder_suite" as any} format="iq" centerHz={freqHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.4)", borderRadius: 10, color: "#A86200", fontSize: 13 }}>
          <strong>OWN DEVICES ONLY</strong> — only transmit OOK codes to devices you own.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>About this protocol</h3>
          <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
            {protocol === "pt2262" && "PT2262 — fixed-code encoder used in cheap remotes, garage door openers, and similar."}
            {protocol === "ev1527" && "EV1527 — learning-code encoder with 24-bit ID + 4-bit data."}
            {protocol === "hcs300" && "HCS300 (KeeLoq) — rolling-code encoder for car keyfobs and high-security remotes."}
            {protocol === "keeloq" && "KeeLoq — Microchip rolling-code algorithm, 32-bit hop code."}
            {protocol === "came" && "CAME — proprietary fixed-code Italian gate opener encoder."}
            {protocol === "nice" && "Nice Flor-S — proprietary rolling-code Italian gate opener encoder."}
          </div>
        </div>
        {txStatus && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}
