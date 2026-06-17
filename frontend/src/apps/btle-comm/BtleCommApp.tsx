import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./BtleComm.css";

interface BleAdvEvent {
  mac: string;
  rssi_db: number;
  adv_type: string;
  data_hex: string;
}

interface BleDevice {
  mac: string;
  rssi: number;
  advType: string;
  name: string | null;
  services: string[];
  dataHex: string;
  lastSeen: Date;
}

// Known BLE 16-bit Service UUIDs
const BLE_SERVICE_NAMES: Record<string, string> = {
  "1800": "Generic Access",
  "1801": "Generic Attribute",
  "1802": "Immediate Alert",
  "1803": "Link Loss",
  "1804": "Tx Power",
  "1805": "Current Time",
  "180A": "Device Information",
  "180D": "Heart Rate",
  "180F": "Battery Service",
  "1812": "Human Interface Device",
  "1816": "Cycling Speed & Cadence",
  "1818": "Cycling Power",
  "181A": "Environmental Sensing",
  "181C": "User Data",
  "1826": "Fitness Machine",
  "FEE0": "Fitbit (proprietary)",
  "FEE7": "FIDO Alliance",
  "FEF3": "Google",
  "FFF0": "Generic (custom)",
  "FFE0": "BLE Serial (HM-10)",
};

function parseBLEAD(hex: string): { name: string | null; services: string[] } {
  let name: string | null = null;
  const services: string[] = [];
  try {
    const bytes = hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
    let i = 0;
    while (i < bytes.length) {
      const len = bytes[i];
      if (!len || i + len >= bytes.length) break;
      const type = bytes[i + 1];
      const data = bytes.slice(i + 2, i + 1 + len);
      if (type === 0x08 || type === 0x09) {
        name = data.map((b) => String.fromCharCode(b)).join("").trim() || null;
      } else if (type === 0x02 || type === 0x03) {
        // 16-bit UUID list
        for (let j = 0; j < data.length - 1; j += 2) {
          const uuid = ((data[j + 1] << 8) | data[j]).toString(16).toUpperCase().padStart(4, "0");
          services.push(uuid);
        }
      } else if (type === 0x06 || type === 0x07) {
        // 128-bit UUID (just note the count)
        const count = Math.floor(data.length / 16);
        for (let k = 0; k < count; k++) services.push("128-bit");
      }
      i += 1 + len;
    }
  } catch { /* ignore */ }
  return { name, services };
}

function formatHexDump(hex: string): string {
  return hex.match(/.{1,2}/g)?.join(" ") ?? hex;
}

export function BtleCommApp() {
  const [devices, setDevices] = useState<Map<string, BleDevice>>(new Map());
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [channel, setChannel] = useState(37);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<BleAdvEvent>("ble_adv", (e) => {
      const { mac, rssi_db, adv_type, data_hex } = e.payload;
      const { name, services } = parseBLEAD(data_hex);
      setDevices((prev) => {
        const next = new Map(prev);
        const ex = next.get(mac);
        next.set(mac, {
          mac,
          rssi: rssi_db,
          advType: adv_type,
          name: name ?? ex?.name ?? null,
          services: services.length > 0 ? services : (ex?.services ?? []),
          dataHex: data_hex,
          lastSeen: new Date(),
        });
        return next;
      });
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setDevices(new Map());
    setSelectedMac(null);
    await startApp("btle_comm" as AppId, {
      channel, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  }, [channel]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const sorted = [...devices.values()].sort((a, b) => b.rssi - a.rssi);
  const selected = selectedMac ? devices.get(selectedMac) : null;

  return (
    <AppScreen
      appId="btle_comm"
      title="BLE Communicator"
      subtitle="GATT explorer"
      status={running ? "live" : devices.size > 0 ? "empty" : "idle"}
      statusText={running ? `Scanning · ${devices.size} devices` : devices.size > 0 ? `${devices.size} devices` : "Idle"}
    >
      {/* Controls */}
      <div className="bcomm__controls">
        <div className="bcomm__chan-row">
          {[37, 38, 39].map((ch) => (
            <button key={ch}
              className={`bcomm__chan-btn${channel === ch ? " bcomm__chan-btn--sel" : ""}`}
              onClick={() => setChannel(ch)}>
              Ch {ch}
            </button>
          ))}
          <span className="bcomm__passive-note">Passive only · no connection</span>
        </div>
        <div className="bcomm__actions">
          <button className={`bcomm__btn bcomm__btn--start${running ? " bcomm__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Scan</button>
          <button className={`bcomm__btn bcomm__btn--stop${!running ? " bcomm__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
          <button className="bcomm__btn bcomm__btn--clear"
            onClick={() => { setDevices(new Map()); setSelectedMac(null); }}>Clear</button>
        </div>
      </div>

      <div className="bcomm__layout">
        {/* Left — device list */}
        <GlassPanel title={`Devices · ${sorted.length}`} size="fill" pad="none"
          className="bcomm__device-panel">
          {sorted.length === 0 ? (
            <div className="bcomm__empty">
              {running ? "Scanning…" : "Press ▶ Scan"}
            </div>
          ) : (
            <div className="bcomm__device-list">
              {sorted.map((dev) => (
                <button
                  key={dev.mac}
                  className={`bcomm__device-row${selectedMac === dev.mac ? " bcomm__device-row--sel" : ""}`}
                  onClick={() => setSelectedMac(dev.mac)}
                >
                  <div className="bcomm__dev-rssi-bar"
                    style={{ width: `${Math.max(4, Math.min(100, ((dev.rssi + 100) / 60) * 100))}%` }} />
                  <div className="bcomm__dev-info">
                    <span className="bcomm__dev-name">
                      {dev.name ?? <span className="bcomm__dev-no-name">Unknown</span>}
                    </span>
                    <span className="bcomm__dev-mac">{dev.mac.toUpperCase()}</span>
                  </div>
                  <span className="bcomm__dev-rssi">{dev.rssi} dB</span>
                </button>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* Right — GATT inspector */}
        <GlassPanel
          title={selected ? `GATT Preview · ${selected.name ?? selected.mac}` : "GATT Preview"}
          size="fill"
          pad="md"
          className="bcomm__gatt-panel"
        >
          {!selected ? (
            <div className="bcomm__gatt-empty">
              Select a device to inspect its advertised GATT services
            </div>
          ) : (
            <div className="bcomm__gatt-content">
              {/* Device header */}
              <div className="bcomm__gatt-header">
                <div className="bcomm__gatt-device-name">
                  {selected.name ?? <span className="bcomm__dev-no-name">Unknown Device</span>}
                </div>
                <div className="bcomm__gatt-mac">{selected.mac.toUpperCase()}</div>
                <div className="bcomm__gatt-meta">
                  <span className="bcomm__meta-badge">{selected.advType}</span>
                  <span className="bcomm__meta-rssi">{selected.rssi} dBm</span>
                  <span className="bcomm__meta-time">
                    {selected.lastSeen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>

              {/* Advertised services tree */}
              <div className="bcomm__services-section">
                <div className="bcomm__section-label">Advertised Services</div>
                {selected.services.length === 0 ? (
                  <div className="bcomm__no-services">No services advertised in AD data</div>
                ) : (
                  <div className="bcomm__service-tree">
                    {selected.services.map((uuid, i) => {
                      const name = BLE_SERVICE_NAMES[uuid] ?? (uuid === "128-bit" ? "Custom 128-bit" : `UUID 0x${uuid}`);
                      return (
                        <div key={i} className="bcomm__service-row">
                          <span className="bcomm__tree-branch">
                            {i === selected.services.length - 1 ? "└─" : "├─"}
                          </span>
                          <span className="bcomm__service-name">{name}</span>
                          {uuid !== "128-bit" && (
                            <span className="bcomm__service-uuid">0x{uuid}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Raw AD data */}
              <div className="bcomm__raw-section">
                <div className="bcomm__section-label">Raw AD Data</div>
                <pre className="bcomm__hex-dump">{formatHexDump(selected.dataHex)}</pre>
              </div>

              <div className="bcomm__connect-note">
                ⓘ Full GATT read/write requires active BLE connection (v0.3)
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      <RecordBar
        appId={"btle_comm" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
      />
    </AppScreen>
  );
}
