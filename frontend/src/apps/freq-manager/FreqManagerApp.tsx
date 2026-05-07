import { useState, useMemo } from "react";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface FreqEntry { freq: string; desc: string; mode: string; }

function parseEntry(line: string): FreqEntry | null {
  const parts: Record<string, string> = {};
  for (const seg of line.split(",")) {
    const [k, v] = seg.split("=");
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  }
  if (!parts["f"]) return null;
  return { freq: parts["f"] ?? "", desc: parts["d"] ?? "", mode: parts["m"] ?? "" };
}

const LS_KEY = "mayhem_freqman";

function loadEntries(): FreqEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

export function FreqManagerApp() {
  const [entries, setEntries] = useState<FreqEntry[]>(loadEntries);
  const [filter, setFilter] = useState("");
  const [newFreq, setNewFreq] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMode, setNewMode] = useState("AM");
  const [raw, setRaw] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const save = (list: FreqEntry[]) => {
    setEntries(list);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  };
  const addEntry = () => {
    if (!newFreq) return;
    save([...entries, { freq: newFreq, desc: newDesc, mode: newMode }]);
    setNewFreq(""); setNewDesc("");
  };
  const importRaw = () => {
    const parsed = raw.split("\n").map(parseEntry).filter(Boolean) as FreqEntry[];
    save([...entries, ...parsed]);
    setRaw("");
    setImportOpen(false);
  };
  const remove = (i: number) => save(entries.filter((_, idx) => idx !== i));

  const filtered = useMemo(
    () => entries.filter((e) => !filter || e.freq.includes(filter) || e.desc.toLowerCase().includes(filter.toLowerCase())),
    [entries, filter]
  );

  return (
    <AppShell
      title="Frequency Manager"
      status={<span>{entries.length} saved · {filtered.length} shown</span>}
      controls={
        <ControlRow
          actions={
            <button className="glass-btn" onClick={() => setImportOpen((o) => !o)}>
              {importOpen ? "Hide import" : "Import freqman"}
            </button>
          }
        >
          <ControlField label="Search" size="lg">
            <input placeholder="freq or description" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ padding: 12, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <ControlField label="Frequency (Hz)" size="md">
            <input placeholder="162550000" value={newFreq} onChange={(e) => setNewFreq(e.target.value)} />
          </ControlField>
          <ControlField label="Mode" size="sm">
            <select value={newMode} onChange={(e) => setNewMode(e.target.value)}>
              {["AM","NFM","WFM","USB","LSB","CW"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </ControlField>
          <ControlField label="Description" size="grow">
            <input placeholder="NOAA Weather Radio" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </ControlField>
          <button className="glass-btn primary" onClick={addEntry} disabled={!newFreq}>Add</button>
        </div>

        {importOpen && (
          <div style={{ padding: 12, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Import freqman text</span>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={4}
              placeholder="f=162550000,d=NOAA Weather,m=NFM"
              style={{ fontFamily: "var(--font-mono)", resize: "vertical" }} />
            <button className="glass-btn primary" onClick={importRaw} style={{ alignSelf: "flex-start" }}>Import</button>
          </div>
        )}

        <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", minHeight: 200 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.85)", textAlign: "left", backdropFilter: "blur(8px)" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Frequency (Hz)</th>
                <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Mode</th>
                <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Description</th>
                <th style={{ padding: "8px 12px", width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{e.freq}</td>
                  <td style={{ padding: "6px 12px", color: "var(--accent)" }}>{e.mode}</td>
                  <td style={{ padding: "6px 12px" }}>{e.desc}</td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    <button onClick={() => remove(entries.indexOf(e))}
                      style={{ background: "transparent", border: "1px solid rgba(255,80,80,0.4)", color: "#ff8080", borderRadius: 4, cursor: "pointer", fontSize: 11, padding: "1px 6px" }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
                  {entries.length === 0 ? "No entries yet — add a frequency above." : "No matches for the current filter."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
