import { useEffect } from "react";
import { listApps } from "./ipc/commands";
import { NfmAudioApp } from "./apps/nfm-audio/NfmAudioApp";
import { AdsbRxApp } from "./apps/adsb-rx/AdsbRxApp";
import { PocsagTxApp } from "./apps/pocsag-tx/PocsagTxApp";
import { useStore } from "./store";

export default function App() {
  const apps = useStore((s) => s.apps);
  const setApps = useStore((s) => s.setApps);
  const activeApp = useStore((s) => s.activeApp);
  const setActiveApp = useStore((s) => s.setActiveApp);

  useEffect(() => {
    listApps().then((a) => {
      setApps(a);
      if (a.length > 0 && activeApp === null) setActiveApp(a[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setApps, setActiveApp]);

  return (
    <div style={{ display: "flex", height: "100vh", color: "#eee", background: "#111" }}>
      <nav style={{ width: 200, padding: 8, background: "#1c1c2c" }}>
        <h3>Apps</h3>
        {apps.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveApp(a.id)}
            style={{
              display: "block",
              width: "100%",
              padding: 6,
              marginBottom: 4,
              background: a.id === activeApp ? "#444" : "transparent",
              color: "#eee",
              border: "1px solid #333",
            }}
          >
            {a.name}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 8, overflow: "auto" }}>
        {activeApp === "nfm_audio" && <NfmAudioApp />}
        {activeApp === "adsb_rx" && <AdsbRxApp />}
        {activeApp === "pocsag_tx" && <PocsagTxApp />}
      </main>
    </div>
  );
}
