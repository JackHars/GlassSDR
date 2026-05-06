import { useState, useMemo } from "react";

interface FreqEntry {
  freq: string;
  desc: string;
  mode: string;
}

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
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}

const inp = { background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 6px", borderRadius: 3 };

export function FreqManagerApp() {
  const [entries, setEntries] = useState<FreqEntry[]>(loadEntries);
  const [filter, setFilter] = useState("");
  const [newFreq, setNewFreq] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMode, setNewMode] = useState("AM");
  const [raw, setRaw] = useState("");

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
  };

  const remove = (i: number) => save(entries.filter((_, idx) => idx !== i));

  const filtered = useMemo(() =>
    entries.filter((e) =>
      !filter || e.freq.includes(filter) || e.desc.toLowerCase().includes(filter.toLowerCase())
    ), [entries, filter]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Frequency Manager</h2>
      <input placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inp, marginBottom: 12, width: 220 }} />

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#222" }}>
            <th style={{ padding: 6, textAlign: "left" }}>Frequency (Hz)</th>
            <th style={{ padding: 6, textAlign: "left" }}>Mode</th>
            <th style={{ padding: 6, textAlign: "left" }}>Description</th>
            <th style={{ padding: 6 }}>Del</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #333" }}>
              <td style={{ padding: 6 }}>{e.freq}</td>
              <td style={{ padding: 6 }}>{e.mode}</td>
              <td style={{ padding: 6 }}>{e.desc}</td>
              <td style={{ padding: 6, textAlign: "center" }}>
                <button onClick={() => remove(entries.indexOf(e))} style={{ background: "#500", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer", padding: "2px 8px" }}>✕</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "#666", textAlign: "center" }}>No entries</td></tr>}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="Freq Hz" value={newFreq} onChange={(e) => setNewFreq(e.target.value)} style={{ ...inp, width: 130 }} />
        <select value={newMode} onChange={(e) => setNewMode(e.target.value)} style={inp}>
          {["AM","NFM","WFM","USB","LSB","CW"].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ ...inp, width: 200 }} />
        <button onClick={addEntry} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "4px 12px", cursor: "pointer" }}>Add</button>
      </div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", color: "#aaa", fontSize: 13 }}>Import freqman text (f=…,d=…,m=…)</summary>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={4} style={{ ...inp, width: "100%", marginTop: 6, boxSizing: "border-box" }} placeholder="f=162550000,d=NOAA Weather,m=NFM" />
        <button onClick={importRaw} style={{ marginTop: 4, background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "4px 12px", cursor: "pointer" }}>Import</button>
      </details>
    </div>
  );
}
