import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

type ServerState = "stopped" | "listening" | "connected";

export function RemoteControlApp() {
  const [port, setPort] = useState(9090);
  const [serverState, setServerState] = useState<ServerState>("stopped");

  const startServer = async () => {
    await startApp("remote_control" as AppId, { port });
    setServerState("listening");
  };
  const stopServer = async () => { await stopApp(); setServerState("stopped"); };

  const stateColor: Record<ServerState, string> = {
    stopped: "#999",
    listening: "#FF9500",
    connected: "#34C759",
  };

  return (
    <AppShell
      title="Remote Control"
      status={
        serverState === "stopped" ? <><span style={{color: stateColor.stopped}}>○</span> Idle</>
        : serverState === "listening" ? <><span style={{color: stateColor.listening}}>●</span> Listening · ws://localhost:{port}</>
        : <><span style={{color: stateColor.connected}}>●</span> Connected · ws://localhost:{port}</>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={startServer} disabled={serverState !== "stopped"}>Start Server</button>
              <button className="glass-btn" onClick={stopServer} disabled={serverState === "stopped"}>Stop</button>
            </>
          }
        >
          <ControlField label="Port" size="sm">
            <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} min={1} max={65535} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"remote_control" as any} format="iq" />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: stateColor[serverState],
          boxShadow: `0 0 24px ${stateColor[serverState]}`,
        }} />
        <div style={{ fontSize: 28, fontWeight: 700, textTransform: "capitalize", color: "var(--text-primary)" }}>
          {serverState}
        </div>
        {serverState !== "stopped" && (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 14 }}>
            ws://localhost:{port}
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
          WebSocket gateway — drive GlassSDR from a browser or remote host. Start the server, then connect a client to the URL above.
        </div>
      </div>
    </AppShell>
  );
}
