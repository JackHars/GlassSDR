import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import "./DecoderFeed.css";

export interface DecoderColumn<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  mono?: boolean;
  render?: (row: T) => ReactNode;
}

interface DecoderFeedProps<T extends { id: string | number }> {
  items: T[];
  columns: DecoderColumn<T>[];
  /** Render the expanded inspector content for a row */
  renderInspector?: (row: T) => ReactNode;
  emptyLabel?: string;
  emptyIcon?: string;
  filterFn?: (item: T, query: string) => boolean;
  maxItems?: number;
  className?: string;
}

/** Virtualized newest-on-top message feed for decoder apps. */
export function DecoderFeed<T extends { id: string | number }>({
  items,
  columns,
  renderInspector,
  emptyLabel = "Waiting for signal…",
  emptyIcon = "📡",
  filterFn,
  maxItems = 500,
  className = "",
}: DecoderFeedProps<T>) {
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [frozenItems, setFrozenItems] = useState<T[]>([]);
  const prevItemsRef = useRef<T[]>(items);

  // When paused, freeze the displayed list
  useEffect(() => {
    if (!paused) {
      prevItemsRef.current = items;
      setFrozenItems([]);
    }
  }, [paused, items]);

  const displayed = paused ? frozenItems : items;

  const pauseAndFreeze = useCallback(() => {
    setFrozenItems(prevItemsRef.current);
    setPaused(true);
  }, []);

  const filtered = filterFn && filter.trim()
    ? displayed.filter((it) => filterFn(it, filter))
    : displayed;

  // Cap to maxItems (newest first = slice from start)
  const visible = filtered.slice(0, maxItems);
  const isEmpty = items.length === 0;

  return (
    <div className={`decoder-feed${className ? ` ${className}` : ""}`}>
      {/* Toolbar */}
      <div className="decoder-feed__toolbar">
        {filterFn && (
          <input
            className="decoder-feed__filter"
            type="text"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        <div className="decoder-feed__toolbar-right">
          <span className="decoder-feed__count">
            {isEmpty ? "—" : `${filtered.length.toLocaleString()} msgs`}
          </span>
          <button
            className={`decoder-feed__pause${paused ? " decoder-feed__pause--paused" : ""}`}
            onClick={() => paused ? (setPaused(false)) : pauseAndFreeze()}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            className="decoder-feed__clear"
            onClick={() => { setFilter(""); setExpandedId(null); }}
            title="Clear filter"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="decoder-feed__scroll">
        {isEmpty && (
          <EmptyState icon={emptyIcon} label={emptyLabel} />
        )}
        {!isEmpty && visible.length === 0 && (
          <EmptyState icon="🔍" label={`No messages match "${filter}"`} />
        )}
        {visible.map((row, idx) => {
          const isNew = !paused && idx === 0;
          const isExpanded = expandedId === row.id;
          return (
            <div
              key={row.id}
              className={`decoder-feed__row${isNew ? " decoder-feed__row--new" : ""}${isExpanded ? " decoder-feed__row--expanded" : ""}${renderInspector ? " decoder-feed__row--clickable" : ""}`}
              onClick={renderInspector ? () => setExpandedId(isExpanded ? null : row.id) : undefined}
            >
              <div className="decoder-feed__cells">
                {columns.map((col) => {
                  const val = col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? "");
                  return (
                    <div
                      key={col.key as string}
                      className={`decoder-feed__cell${col.mono ? " decoder-feed__cell--mono" : ""}`}
                      style={col.width ? { width: col.width, flexShrink: 0 } : { flex: 1, minWidth: 0 }}
                    >
                      {val}
                    </div>
                  );
                })}
                {renderInspector && (
                  <div className="decoder-feed__chevron">{isExpanded ? "▴" : "▾"}</div>
                )}
              </div>
              {isExpanded && renderInspector && (
                <div className="decoder-feed__inspector" onClick={(e) => e.stopPropagation()}>
                  {renderInspector(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Column headers */}
      <div className="decoder-feed__header">
        {columns.map((col) => (
          <div
            key={col.key as string}
            className="decoder-feed__header-cell"
            style={col.width ? { width: col.width, flexShrink: 0 } : { flex: 1, minWidth: 0 }}
          >
            {col.label}
          </div>
        ))}
        {renderInspector && <div style={{ width: 20 }} />}
      </div>
    </div>
  );
}

/* ── FieldInspector ─────────────────────────────────────────────────────────
   Labeled key/value grid for decoded packet fields with raw-hex toggle.
   ────────────────────────────────────────────────────────────────────────── */

export interface InspectorField {
  label: string;
  value: string | number | boolean | null | undefined;
  hex?: string;
  mono?: boolean;
  accent?: boolean;
}

interface FieldInspectorProps {
  fields: InspectorField[];
  title?: string;
}

export function FieldInspector({ fields, title }: FieldInspectorProps) {
  const [showHex, setShowHex] = useState(false);
  const hasHex = fields.some((f) => f.hex !== undefined);

  return (
    <div className="field-inspector">
      {(title || hasHex) && (
        <div className="field-inspector__header">
          {title && <span className="field-inspector__title">{title}</span>}
          {hasHex && (
            <button
              className={`field-inspector__hex-toggle${showHex ? " active" : ""}`}
              onClick={() => setShowHex(!showHex)}
            >
              {showHex ? "Decoded" : "Raw hex"}
            </button>
          )}
        </div>
      )}
      <div className="field-inspector__grid">
        {fields.map((f, i) => {
          const display = showHex && f.hex !== undefined ? f.hex : (f.value === null || f.value === undefined ? "—" : String(f.value));
          return (
            <div key={i} className={`field-inspector__row${f.accent ? " field-inspector__row--accent" : ""}`}>
              <span className="field-inspector__label">{f.label}</span>
              <span className={`field-inspector__value${f.mono || (showHex && f.hex) ? " field-inspector__value--mono" : ""}`}>
                {display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── EmptyState ────────────────────────────────────────────────────────────
   Shown when a decoder has no data yet or a filter matches nothing.
   ────────────────────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: string;
  label: string;
  sublabel?: string;
}

export function EmptyState({ icon = "📡", label, sublabel }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state__icon">{icon}</span>}
      <span className="empty-state__label">{label}</span>
      {sublabel && <span className="empty-state__sublabel">{sublabel}</span>}
    </div>
  );
}
