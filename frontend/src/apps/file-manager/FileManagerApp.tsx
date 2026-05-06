import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inp = { background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 6px", borderRadius: 3 };

export function FileManagerApp() {
  const [path, setPath] = useState("/");
  const [inputPath, setInputPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<FileEntry[]>("list_directory", { path: target });
      setEntries(list);
      setPath(target);
      setInputPath(target);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {
    const parts = path.replace(/\/$/, "").split("/");
    parts.pop();
    browse(parts.join("/") || "/");
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>File Manager</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={goUp} style={{ ...inp, cursor: "pointer" }}>↑ Up</button>
        <input value={inputPath} onChange={(e) => setInputPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && browse(inputPath)} style={{ ...inp, flex: 1 }} />
        <button onClick={() => browse(inputPath)} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "4px 12px", cursor: "pointer" }}>Go</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: 8, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: "#aaa", fontSize: 13 }}>Loading…</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#222" }}>
            <th style={{ padding: 6, textAlign: "left" }}>Name</th>
            <th style={{ padding: 6, textAlign: "left" }}>Type</th>
            <th style={{ padding: 6, textAlign: "right" }}>Size</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.path} style={{ borderBottom: "1px solid #2a2a2a", cursor: e.is_dir ? "pointer" : "default" }}
              onClick={() => e.is_dir && browse(e.path)}>
              <td style={{ padding: "5px 6px", color: e.is_dir ? "#8af" : "#eee" }}>
                {e.is_dir ? "📁 " : "📄 "}{e.name}
              </td>
              <td style={{ padding: "5px 6px", color: "#888" }}>{e.is_dir ? "Directory" : "File"}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", color: "#888" }}>{e.is_dir ? "—" : fmtSize(e.size_bytes)}</td>
            </tr>
          ))}
          {entries.length === 0 && !loading && (
            <tr><td colSpan={3} style={{ padding: 16, color: "#555", textAlign: "center" }}>Browse to a directory to list files</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
