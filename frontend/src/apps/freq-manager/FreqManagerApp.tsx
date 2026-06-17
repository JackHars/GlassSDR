import { useState, useMemo } from "react";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { Icon } from "../../components/kit/Icon";
import { FrequencyInput } from "../../components/FrequencyInput";
import "./FreqManager.css";

interface FreqEntry {
  id: string;
  freqHz: number;
  mode: string;
  desc: string;
  group: string;
  bwHz?: number;
}

const MODES = ["AM", "NFM", "WFM", "USB", "LSB", "CW", "POCSAG", "AIS", "ADS-B", "APRS", "Other"];

const LS_KEY = "mayhem_freqman_v2";
const LS_KEY_LEGACY = "mayhem_freqman";

function loadEntries(): FreqEntry[] {
  try {
    const v2 = localStorage.getItem(LS_KEY);
    if (v2) return JSON.parse(v2);
    // Migrate legacy entries
    const legacy = localStorage.getItem(LS_KEY_LEGACY);
    if (!legacy) return [];
    const old = JSON.parse(legacy) as { freq: string; desc: string; mode: string }[];
    return old.map((e, i) => ({
      id: `legacy-${i}`,
      freqHz: parseFloat(e.freq) || 0,
      mode: e.mode || "NFM",
      desc: e.desc || "",
      group: "",
    }));
  } catch { return []; }
}

function saveEntries(entries: FreqEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function fmtHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(4)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(4)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz} Hz`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MODE_COLORS: Record<string, string> = {
  AM: "rgba(240,160,58,0.9)",
  NFM: "rgba(56,112,200,0.9)",
  WFM: "rgba(96,64,208,0.9)",
  USB: "rgba(200,140,50,0.9)",
  LSB: "rgba(180,120,40,0.9)",
  CW: "rgba(240,160,58,0.9)",
  POCSAG: "rgba(220,80,140,0.9)",
  AIS: "rgba(30,140,195,0.9)",
  "ADS-B": "rgba(30,180,100,0.9)",
  APRS: "rgba(200,120,50,0.9)",
  Other: "rgba(130,120,200,0.9)",
};

function getModeColor(mode: string): string {
  return MODE_COLORS[mode] ?? "rgba(130,130,130,0.9)";
}

// ── Frequency Card ────────────────────────────────────────────────────────────

interface FreqCardProps {
  entry: FreqEntry;
  onDelete: (id: string) => void;
}

function FreqCard({ entry, onDelete }: FreqCardProps) {
  const modeColor = getModeColor(entry.mode);
  return (
    <div className="fmgr-card">
      <div className="fmgr-card__mode-stripe" style={{ background: modeColor }} />
      <div className="fmgr-card__body">
        <div className="fmgr-card__freq">{fmtHz(entry.freqHz)}</div>
        <div className="fmgr-card__meta">
          <span className="fmgr-card__mode-badge" style={{ background: modeColor.replace("0.9)", "0.12)"), color: modeColor.replace("0.9)", "1)").replace("rgba", "rgb") }}>
            {entry.mode}
          </span>
          {entry.group && <span className="fmgr-card__group">{entry.group}</span>}
          {entry.desc && <span className="fmgr-card__desc">{entry.desc}</span>}
        </div>
        {entry.bwHz && (
          <div className="fmgr-card__bw">BW {fmtHz(entry.bwHz)}</div>
        )}
      </div>
      <button
        className="fmgr-card__del"
        onClick={() => onDelete(entry.id)}
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FreqManagerApp() {
  const [entries, setEntries]   = useState<FreqEntry[]>(loadEntries);
  const [filter, setFilter]     = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [showAdd, setShowAdd]   = useState(false);

  // Add-form state
  const [newFreqHz, setNewFreqHz] = useState(162_550_000);
  const [newMode, setNewMode]     = useState("NFM");
  const [newDesc, setNewDesc]     = useState("");
  const [newGroup, setNewGroup]   = useState("");

  const persist = (list: FreqEntry[]) => {
    setEntries(list);
    saveEntries(list);
  };

  const addEntry = () => {
    if (!newFreqHz) return;
    const entry: FreqEntry = { id: uid(), freqHz: newFreqHz, mode: newMode, desc: newDesc, group: newGroup };
    persist([...entries, entry]);
    setNewDesc(""); setNewGroup(""); setShowAdd(false);
  };

  const deleteEntry = (id: string) => persist(entries.filter((e) => e.id !== id));

  const groups = useMemo(() => {
    const gs = Array.from(new Set(entries.map((e) => e.group).filter(Boolean)));
    return gs.sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (groupFilter !== "all") list = list.filter((e) => e.group === groupFilter);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (e) =>
          fmtHz(e.freqHz).toLowerCase().includes(q) ||
          e.desc.toLowerCase().includes(q) ||
          e.mode.toLowerCase().includes(q) ||
          e.group.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.freqHz - b.freqHz);
  }, [entries, filter, groupFilter]);

  const appStatus: AppStatus = "idle";
  const statusText = filter
    ? `${filtered.length} of ${entries.length} shown`
    : `${entries.length} saved`;

  return (
    <AppScreen
      appId="freq_manager"
      title="Frequency Manager"
      subtitle="Memory Bank"
      status={appStatus}
      statusText={statusText}
      actions={
        <button
          className={`fmgr-btn-add${showAdd ? " fmgr-btn-add--active" : ""}`}
          onClick={() => setShowAdd((v) => !v)}
        >
          {showAdd ? <><Icon name="close" size={14} /> Cancel</> : "+ Add"}
        </button>
      }
      controls={
        <div className="fmgr-controls">
          <input
            className="fmgr-search"
            type="text"
            placeholder="Search frequency, description, mode…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {groups.length > 0 && (
            <div className="fmgr-group-tabs">
              <button
                className={`fmgr-group-tab${groupFilter === "all" ? " fmgr-group-tab--on" : ""}`}
                onClick={() => setGroupFilter("all")}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  className={`fmgr-group-tab${groupFilter === g ? " fmgr-group-tab--on" : ""}`}
                  onClick={() => setGroupFilter(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <div className="fmgr-layout">
        {/* Add form */}
        {showAdd && (
          <GlassPanel title="Add Frequency" accent pad="md" style={{ flexShrink: 0 }}>
            <div className="fmgr-add-form">
              <div className="fmgr-add-form__row">
                <div className="fmgr-add-field">
                  <label className="fmgr-add-label">Frequency</label>
                  <FrequencyInput hz={newFreqHz} onChange={setNewFreqHz} autoUnit />
                </div>
                <div className="fmgr-add-field">
                  <label className="fmgr-add-label">Mode</label>
                  <select
                    className="fmgr-add-select"
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value)}
                  >
                    {MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="fmgr-add-field fmgr-add-field--grow">
                  <label className="fmgr-add-label">Description</label>
                  <input
                    className="fmgr-add-input"
                    type="text"
                    placeholder="NOAA Weather Radio"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="fmgr-add-field">
                  <label className="fmgr-add-label">Group</label>
                  <input
                    className="fmgr-add-input fmgr-add-input--sm"
                    type="text"
                    placeholder="Weather"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                  />
                </div>
                <button
                  className="fmgr-add-btn"
                  onClick={addEntry}
                  disabled={!newFreqHz}
                >
                  Save
                </button>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* Frequency list */}
        <div className="fmgr-list">
          {filtered.length === 0 ? (
            <div className="fmgr-empty">
              <div className="fmgr-empty__icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="6" y="4" width="36" height="40" rx="5" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3" />
                  <line x1="12" y1="16" x2="36" y2="16" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="12" y1="24" x2="36" y2="24" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.3" />
                  <line x1="12" y1="32" x2="24" y2="32" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.3" />
                </svg>
              </div>
              <div className="fmgr-empty__title">
                {entries.length === 0 ? "No frequencies saved" : "No matches"}
              </div>
              <div className="fmgr-empty__sub">
                {entries.length === 0
                  ? "Press + Add to save your first frequency memory."
                  : "Try adjusting the search or group filter."}
              </div>
            </div>
          ) : (
            filtered.map((entry) => (
              <FreqCard key={entry.id} entry={entry} onDelete={deleteEntry} />
            ))
          )}
        </div>
      </div>
    </AppScreen>
  );
}
