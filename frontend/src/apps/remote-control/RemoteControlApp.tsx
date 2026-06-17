import { useState, useCallback } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { Icon } from "../../components/kit/Icon";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./RemoteControl.css";

type ServerState = "stopped" | "listening" | "connected";

// ── QR placeholder SVG ────────────────────────────────────────────────────────
// A decorative QR-like pattern (not a real QR, just the visual identity)

function QrPlaceholder({ url }: { url: string }) {
  return (
    <div className="rc-qr-wrap">
      <svg className="rc-qr-svg" viewBox="0 0 80 80" fill="none">
        {/* Finder squares (top-left, top-right, bottom-left) */}
        <rect x="4"  y="4"  width="22" height="22" rx="3" stroke="currentColor" strokeWidth="3" fill="none" />
        <rect x="7"  y="7"  width="16" height="16" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <rect x="10" y="10" width="10" height="10" rx="1" fill="currentColor" />

        <rect x="54" y="4"  width="22" height="22" rx="3" stroke="currentColor" strokeWidth="3" fill="none" />
        <rect x="57" y="7"  width="16" height="16" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <rect x="60" y="10" width="10" height="10" rx="1" fill="currentColor" />

        <rect x="4"  y="54" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="3" fill="none" />
        <rect x="7"  y="57" width="16" height="16" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <rect x="10" y="60" width="10" height="10" rx="1" fill="currentColor" />

        {/* Data modules (decorative) */}
        {[30,35,40,45,50,55].map((y) =>
          [30,35,40,45,50,55,60,65,70].map((x) =>
            Math.sin(x * y * 0.01) > 0 ? (
              <rect key={`${x}-${y}`} x={x - 1} y={y - 1} width="3.5" height="3.5" rx="0.5" fill="currentColor" fillOpacity="0.7" />
            ) : null
          )
        )}
      </svg>
      <div className="rc-qr-label">{url}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RemoteControlApp() {
  const [port, setPort]           = useState(9090);
  const [serverState, setServerState] = useState<ServerState>("stopped");
  const [copied, setCopied]       = useState(false);

  const wsUrl = `ws://localhost:${port}`;
  const httpUrl = `http://localhost:${port}`;

  const handleStart = useCallback(async () => {
    await startApp("remote_control" as AppId, { port });
    setServerState("listening");
  }, [port]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setServerState("stopped");
  }, []);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(wsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [wsUrl]);

  const appStatus: AppStatus =
    serverState === "connected" ? "live"
    : serverState === "listening" ? "acquiring"
    : "idle";

  const statusText =
    serverState === "connected" ? "Client connected"
    : serverState === "listening" ? `Listening · port ${port}`
    : "Server stopped";

  return (
    <AppScreen
      appId="remote_control"
      title="Remote Control"
      subtitle="Network Server"
      status={appStatus}
      statusText={statusText}
      actions={
        serverState !== "stopped" ? (
          <button className="rc-btn rc-btn--stop" onClick={handleStop}>■ Stop Server</button>
        ) : (
          <button className="rc-btn rc-btn--start" onClick={handleStart}>⊙ Start Server</button>
        )
      }
      controls={
        <div className="rc-controls">
          <div className="rc-ctrl-field">
            <label className="rc-ctrl-label">Port</label>
            <input
              className="rc-ctrl-input"
              type="number"
              value={port}
              min={1024}
              max={65535}
              onChange={(e) => setPort(Math.max(1024, Math.min(65535, Number(e.target.value))))}
              disabled={serverState !== "stopped"}
            />
          </div>
          {serverState !== "stopped" && (
            <div className="rc-ctrl-url">
              <span className="rc-ctrl-url__val">{wsUrl}</span>
              <button className="rc-ctrl-copy" onClick={copyUrl}>{copied ? <Icon name="check" size={14} /> : "Copy"}</button>
            </div>
          )}
        </div>
      }
      footer={<RecordBar appId={"remote_control" as AppId} format="iq" />}
    >
      <div className="rc-layout">
        {/* State card — the hero */}
        <GlassPanel title="Server Console" pad="md">
          <div className="rc-console">
            {/* Power indicator */}
            <div className={`rc-power rc-power--${serverState}`}>
              <div className="rc-power__orb" />
              <div className="rc-power__state">{
                serverState === "stopped" ? "Offline"
                : serverState === "listening" ? "Online"
                : "Connected"
              }</div>
            </div>

            {serverState !== "stopped" ? (
              <div className="rc-online-panel">
                <QrPlaceholder url={wsUrl} />
                <div className="rc-address-list">
                  <div className="rc-address-row">
                    <span className="rc-address-type">WebSocket</span>
                    <span className="rc-address-val">{wsUrl}</span>
                  </div>
                  <div className="rc-address-row">
                    <span className="rc-address-type">HTTP</span>
                    <span className="rc-address-val">{httpUrl}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rc-offline-hint">
                Press <strong>⊙ Start Server</strong> to enable remote control via WebSocket.
                Any device on the same network can then connect.
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Clients panel */}
        <GlassPanel title="Connected Clients">
          {serverState === "stopped" ? (
            <div className="rc-clients-empty">Server is offline — no clients can connect</div>
          ) : (
            <div className="rc-clients-empty" style={{ color: "var(--accent)" }}>
              Waiting for client connections on port {port}…
            </div>
          )}
        </GlassPanel>

        {/* Network info */}
        <GlassPanel title="Protocol">
          <div className="rc-proto-info">
            <div className="rc-proto-row">
              <span className="rc-proto-label">Protocol</span>
              <span className="rc-proto-val">WebSocket (RFC 6455)</span>
            </div>
            <div className="rc-proto-row">
              <span className="rc-proto-label">Messages</span>
              <span className="rc-proto-val">JSON</span>
            </div>
            <div className="rc-proto-row">
              <span className="rc-proto-label">Commands</span>
              <span className="rc-proto-val">start_app, stop_app, tune, set_gain</span>
            </div>
            <div className="rc-proto-row">
              <span className="rc-proto-label">Auth</span>
              <span className="rc-proto-val">None (LAN only)</span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
