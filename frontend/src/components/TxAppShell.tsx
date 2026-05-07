import { ReactNode, useEffect, useState } from "react";
import { useStore } from "../store";
import { armTx, disarmTx, startApp } from "../ipc/commands";
import { onTxStatus } from "../ipc/events";
import { LegalBanner } from "./LegalBanner";
import { RecordBar } from "./RecordBar";
import { AppShell, ControlField, ControlRow } from "./AppShell";
import type { AppId } from "../ipc/types/AppId";

type WarningLevel = "indoor-only" | "own-devices-only" | "amateur-only" | "none";

interface Props {
  title: string;
  appId: AppId;
  /** Brief subtitle shown next to the status pill when idle. */
  subtitle?: string;
  /** Color/strictness of the warning banner. */
  warning?: WarningLevel;
  /** Override warning copy. */
  warningText?: string;
  /** Frequency value (Hz) tagged on the IQ recording sidecar. Pass undefined when frequency is not applicable. */
  centerHz?: number;
  /** Build the start_app params object from current state. */
  buildParams: () => unknown;
  /** Toolbar fields rendered to the left of arm/transmit buttons. */
  fields: ReactNode;
  /** Optional body content (preview pane, message editor, etc.). */
  children?: ReactNode;
  /** Custom transmit button label, e.g. "REPLAY". */
  transmitLabel?: string;
}

const WARNINGS: Record<WarningLevel, { color: string; bg: string; border: string; text: string }> = {
  "indoor-only": {
    color: "#FF3B30",
    bg: "rgba(255,59,48,0.08)",
    border: "rgba(255,59,48,0.4)",
    text: "INDOOR TEST ONLY — transmissions on this band require explicit authorization. Use a shielded environment with a dummy load.",
  },
  "own-devices-only": {
    color: "#A86200",
    bg: "rgba(255,149,0,0.08)",
    border: "rgba(255,149,0,0.4)",
    text: "OWN DEVICES ONLY — only target devices you own and are licensed to operate.",
  },
  "amateur-only": {
    color: "#0066DD",
    bg: "rgba(0,122,255,0.08)",
    border: "rgba(0,122,255,0.4)",
    text: "AMATEUR ONLY — requires an active amateur radio license for the chosen band.",
  },
  none: { color: "", bg: "", border: "", text: "" },
};

export function TxAppShell({
  title, appId, subtitle, warning = "own-devices-only", warningText,
  centerHz, buildParams, fields, children, transmitLabel = "TRANSMIT",
}: Props) {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    const p = onTxStatus((s) => setTxStatus(s));
    return () => { p.then((fn) => fn()); };
  }, [setTxStatus]);

  const handleArm = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await armTx();
    setArmed(true);
  };
  const handleDisarm = async () => { await disarmTx(); setArmed(false); };
  const handleTransmit = async () => {
    if (!armed) return;
    await startApp(appId as AppId, buildParams() as any);
    setArmed(false);
  };

  const status =
    armed ? <><span style={{color: "#FF9500"}}>●</span> Armed — ready to transmit</>
    : txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
    : <><span style={{color: "#999"}}>○</span> Idle{subtitle ? ` · ${subtitle}` : ""}</>;

  const w = WARNINGS[warning];

  return (
    <AppShell
      title={title}
      status={status}
      controls={
        <ControlRow
          actions={
            !armed
              ? <button className="glass-btn" onClick={handleArm} style={{ background: "#FF9500", color: "#fff" }}>ARM TX</button>
              : <>
                  <button className="glass-btn" onClick={handleDisarm}>Disarm</button>
                  <button className="glass-btn" onClick={handleTransmit} style={{ background: "#FF3B30", color: "#fff", fontWeight: 700 }}>{transmitLabel}</button>
                </>
          }
        >
          {fields}
        </ControlRow>
      }
      footer={<RecordBar appId={appId} format="iq" centerHz={centerHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        {warning !== "none" && (
          <div style={{ padding: "12px 16px", background: w.bg, border: `1px solid ${w.border}`, borderRadius: 10, color: w.color, fontSize: 13 }}>
            <strong style={{ marginRight: 6 }}>{(warningText ?? w.text).split("—")[0].trim()}</strong>
            <span>—{(warningText ?? w.text).split("—").slice(1).join("—")}</span>
          </div>
        )}
        {children}
        {txStatus && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Re-export for convenience in TX apps. */
export { ControlField, ControlRow };
