import { useEffect, useState, ReactNode } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../LegalBanner";
import { Icon } from "./Icon";
import type { AppId } from "../../ipc/types/AppId";
import "./ArmConsole.css";

type WarningLevel = "indoor-only" | "own-devices-only" | "amateur-only" | "none";

const WARNING_TEXT: Record<WarningLevel, string> = {
  "indoor-only":       "INDOOR / SHIELDED TEST ONLY — transmissions require explicit authorization. Use a dummy load.",
  "own-devices-only":  "OWN DEVICES ONLY — only target devices you own and are licensed to operate.",
  "amateur-only":      "AMATEUR LICENSE REQUIRED — a valid amateur radio license is required for the chosen band.",
  none: "",
};

interface ArmConsoleProps {
  appId: AppId;
  buildParams: () => unknown;
  warning?: WarningLevel;
  warningText?: string;
  transmitLabel?: string;
  /** Extra controls to show alongside ARM/TRANSMIT buttons */
  extra?: ReactNode;
  children?: ReactNode;
}

/** Wraps arm/disarm + LegalBanner TX gate in the hazard-striped TX identity.
 *  Restyle of TxAppShell's action flow — plumbing is preserved, not replaced. */
export function ArmConsole({
  appId,
  buildParams,
  warning = "own-devices-only",
  warningText,
  transmitLabel = "TRANSMIT",
  extra,
  children,
}: ArmConsoleProps) {
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
    await startApp(appId, buildParams() as Parameters<typeof startApp>[1]);
    setArmed(false);
  };

  const isTransmitting = txStatus?.kind === "transmitting";
  const progress = txStatus?.progress_pct;

  return (
    <div
      className={`arm-console${armed ? " arm-console--armed" : ""}${isTransmitting ? " arm-console--live" : ""}`}
    >
      {/* Hazard warning banner */}
      {warning !== "none" && (
        <div className="arm-console__warning">
          <span className="arm-console__warning-icon"><Icon name="warning" size={16} /></span>
          <span className="arm-console__warning-text">{warningText ?? WARNING_TEXT[warning]}</span>
        </div>
      )}

      {/* Legal banner overlay */}
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}

      {/* Composer / editor slot */}
      {children && <div className="arm-console__body">{children}</div>}

      {/* Transmit progress bar */}
      {isTransmitting && progress !== undefined && (
        <div className="arm-console__progress-track">
          <div className="arm-console__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Status + action row */}
      <div className="arm-console__footer">
        <div className="arm-console__status-text">
          {isTransmitting
            ? `Transmitting${progress !== undefined ? ` · ${progress}%` : ""}${txStatus?.message ? ` · ${txStatus.message}` : ""}`
            : armed
            ? "Armed — ready to transmit"
            : "Disarmed"}
        </div>
        {extra}
        <div className="arm-console__actions">
          {!armed && !isTransmitting && (
            <button className="arm-console__btn arm-console__btn--arm" onClick={handleArm}>
              ARM TX
            </button>
          )}
          {armed && !isTransmitting && (
            <>
              <button className="arm-console__btn arm-console__btn--disarm" onClick={handleDisarm}>
                Disarm
              </button>
              <button className="arm-console__btn arm-console__btn--transmit" onClick={handleTransmit}>
                {transmitLabel}
              </button>
            </>
          )}
          {isTransmitting && (
            <button className="arm-console__btn arm-console__btn--live" disabled>
              ● Live
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
