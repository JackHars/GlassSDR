import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./BtleRx.css";

interface BleAdvEvent {
  mac: string;
  rssi_db: number;
  adv_type: string;
  data_hex: string;
}

interface BleDevice {
  mac: string;
  rssi: number;
  peakRssi: number;
  advType: string;
  name: string | null;
  dataHex: string;
  lastSeen: Date;
  count: number;
}

const ADV_CHANNELS = [
  { ch: 37, mhz: 2402 },
  { ch: 38, mhz: 2426 },
  { ch: 39, mhz: 2480 },
];

/** Parse BLE Local Name from raw advertisement data hex string */
function parseBLEName(hex: string): string | null {
  try {
    const bytes = hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
    let i = 0;
    while (i < bytes.length) {
      const len = bytes[i];
      if (!len || i + len >= bytes.length) break;
      const type = bytes[i + 1];
      if (type === 0x08 || type === 0x09) {
        // Complete (0x09) or Shortened (0x08) Local Name
        const nameBytes = bytes.slice(i + 2, i + 1 + len);
        const name = nameBytes.map((b) => String.fromCharCode(b)).join("").trim();
        if (name) return name;
      }
      i += 1 + len;
    }
  } catch { /* ignore */ }
  return null;
}

/** RSSI → 0-5 proximity bars */
function rssiToBars(rssi: number): number {
  if (rssi > -50) return 5;
  if (rssi > -60) return 4;
  if (rssi > -70) return 3;
  if (rssi > -80) return 2;
  if (rssi > -90) return 1;
  return 0;
}

function RssiBars({ rssi }: { rssi: number }) {
  const filled = rssiToBars(rssi);
  return (
    <div className="ble-rx__rssi-bars" aria-label={`RSSI ${rssi} dBm`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`ble-rx__rssi-bar${i <= filled ? " ble-rx__rssi-bar--filled" : ""}`}
          style={{ height: `${40 + i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function BtleRxApp() {
  const [devices, setDevices] = useState<Map<string, BleDevice>>(new Map());
  const [channel, setChannel] = useState(37);
  const [running, setRunning] = useState(false);
  const [sortBy, setSortBy] = useState<"rssi" | "time">("rssi");

  useEffect(() => {
    const p = listen<BleAdvEvent>("ble_adv", (e) => {
      const { mac, rssi_db, adv_type, data_hex } = e.payload;
      setDevices((prev) => {
        const next = new Map(prev);
        const existing = next.get(mac);
        const name = parseBLEName(data_hex) ?? existing?.name ?? null;
        next.set(mac, {
          mac,
          rssi: rssi_db,
          peakRssi: existing ? Math.max(existing.peakRssi, rssi_db) : rssi_db,
          advType: adv_type,
          name,
          dataHex: data_hex,
          lastSeen: new Date(),
          count: (existing?.count ?? 0) + 1,
        });
        return next;
      });
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setDevices(new Map());
    await startApp("btle_rx" as AppId, {
      channel,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });
    setRunning(true);
  }, [channel]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const sorted = [...devices.values()].sort((a, b) =>
    sortBy === "rssi" ? b.rssi - a.rssi : b.lastSeen.getTime() - a.lastSeen.getTime()
  );

  const chInfo = ADV_CHANNELS.find((c) => c.ch === channel);

  return (
    <AppScreen
      appId="btle_rx"
      title="BLE Scanner"
      subtitle={`Ch ${channel} · ${chInfo?.mhz} MHz`}
      status={running ? "live" : devices.size > 0 ? "empty" : "idle"}
      statusText={running ? `Sniffing · ${devices.size} devices` : devices.size > 0 ? `${devices.size} devices found` : "Idle"}
    >
      {/* Controls */}
      <div className="ble-rx__controls">
        <div className="ble-rx__chan-btns">
          {ADV_CHANNELS.map(({ ch, mhz }) => (
            <button
              key={ch}
              className={`ble-rx__chan-btn${channel === ch ? " ble-rx__chan-btn--sel" : ""}`}
              onClick={() => setChannel(ch)}
              aria-pressed={channel === ch}
            >
              <span className="ble-rx__chan-num">Ch {ch}</span>
              <span className="ble-rx__chan-mhz">{mhz} MHz</span>
            </button>
          ))}
        </div>
        <div className="ble-rx__sort-row">
          <span className="ble-rx__sort-label">Sort</span>
          <button className={`ble-rx__sort-btn${sortBy === "rssi" ? " ble-rx__sort-btn--sel" : ""}`}
            onClick={() => setSortBy("rssi")}>RSSI</button>
          <button className={`ble-rx__sort-btn${sortBy === "time" ? " ble-rx__sort-btn--sel" : ""}`}
            onClick={() => setSortBy("time")}>Last seen</button>
        </div>
        <div className="ble-rx__actions">
          <button className={`ble-rx__btn ble-rx__btn--start${running ? " ble-rx__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Scan</button>
          <button className={`ble-rx__btn ble-rx__btn--stop${!running ? " ble-rx__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
          <button className="ble-rx__btn ble-rx__btn--clear"
            onClick={() => setDevices(new Map())}>Clear</button>
        </div>
      </div>

      {/* Device feed hero */}
      <GlassPanel
        title={`Discovered Devices · ${sorted.length}`}
        size="fill"
        pad="none"
        className="ble-rx__feed-panel"
      >
        {sorted.length === 0 ? (
          <div className="ble-rx__empty">
            {running ? `Listening on channel ${channel} (${chInfo?.mhz} MHz)…` : "Press ▶ Scan to start BLE advertisement sniffing"}
          </div>
        ) : (
          <div className="ble-rx__device-list">
            {sorted.map((dev) => {
              const bars = rssiToBars(dev.rssi);
              const proximity = bars >= 4 ? "Immediate" : bars >= 3 ? "Near" : bars >= 2 ? "Medium" : "Far";
              return (
                <div key={dev.mac} className="ble-rx__device-card">
                  {/* Left: RSSI bars */}
                  <div className="ble-rx__card-signal">
                    <RssiBars rssi={dev.rssi} />
                    <span className="ble-rx__proximity">{proximity}</span>
                  </div>

                  {/* Center: device info */}
                  <div className="ble-rx__card-info">
                    <div className="ble-rx__device-name">
                      {dev.name ?? <span className="ble-rx__no-name">Unknown</span>}
                    </div>
                    <div className="ble-rx__device-mac">{dev.mac.toUpperCase()}</div>
                    <div className="ble-rx__device-meta">
                      <span className="ble-rx__adv-type">{dev.advType}</span>
                      <span className="ble-rx__seen-count">{dev.count}×</span>
                      <span className="ble-rx__last-seen">
                        {dev.lastSeen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Right: dBm readout */}
                  <div className="ble-rx__card-rssi">
                    <span className="ble-rx__rssi-val">{dev.rssi}</span>
                    <span className="ble-rx__rssi-unit">dBm</span>
                    {dev.peakRssi !== dev.rssi && (
                      <span className="ble-rx__rssi-peak">pk {dev.peakRssi}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"btle_rx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
      />
    </AppScreen>
  );
}
