import { ReactNode } from "react";

interface Props<T> {
  headers: string[];
  rows: T[];
  renderRow: (row: T, i: number) => ReactNode[];
  rowKey?: (row: T, i: number) => string | number;
  emptyMessage?: string;
}

export function DecoderTable<T>({ headers, rows, renderRow, rowKey, emptyMessage }: Props<T>) {
  return (
    <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", minHeight: 200 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.85)", textAlign: "left", backdropFilter: "blur(8px)" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {renderRow(row, i).map((cell, j) => (
                <td key={j} style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
                {emptyMessage ?? "No data yet — press Start to begin."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
