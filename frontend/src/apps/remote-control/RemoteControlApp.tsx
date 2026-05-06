import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 100,
};

type ServerState = "stopped" | "listening" | "connected";

export function RemoteControlApp() {
  const [port, setPort] = useState(9090);
  const [serverState, setServerState] = useState<ServerState>("stopped");

  const startServer = () => {
    startApp("remote_control" as AppId, { port });
    setServerState("listening");
  };
  const stopServer = () => { stopApp(); setServerState("stopped"); };

  const stateColor: Record<ServerState, string> = {
    stopped: "#666",
    listening: "#fa0",
    connected: "#4c4",
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Remote Control</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        WebSocket gateway — control Mayhem from a remote host or browser.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <label>Port:</label>
        <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} style={inp} min={1} max={65535} />
        <button onClick={startServer} disabled={serverState !== "stopped"}
          style={{ padding: "7px 14px", background: "#226", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Start Server
        </button>
        <button onClick={stopServer} disabled={serverState === "stopped"}
          style={{ padding: "7px 14px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 12, height: 12, borderRadius: "50%",
          background: stateColor[serverState], boxShadow: `0 0 6px ${stateColor[serverState]}`,
        }} />
        <span style={{ color: stateColor[serverState], fontWeight: 600, textTransform: "capitalize" }}>
          {serverState}
        </span>
        {serverState === "listening" && (
          <span style={{ color: "#888", fontSize: 12 }}>ws://localhost:{port}</span>
        )}
      </div>
    </div>
  );
}
