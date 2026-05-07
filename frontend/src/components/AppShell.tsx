import { ReactNode } from "react";

interface Props {
  title: string;
  status?: ReactNode;
  controls?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** When true (default for apps with maps/waterfalls/tables), main grows to fill window. When false, content sits at natural height with the footer pinned. */
  fillMain?: boolean;
}

export function AppShell({
  title,
  status,
  controls,
  footer,
  children,
  fillMain = true,
}: Props) {
  return (
    <div className="app-shell">
      <div className="app-shell__header">
        <h2 className="app-shell__title">{title}</h2>
        {status !== undefined && <div className="app-shell__status">{status}</div>}
      </div>
      {controls !== undefined && <div className="app-shell__toolbar">{controls}</div>}
      <div className={fillMain ? "app-shell__main app-shell__main--fill" : "app-shell__main"}>
        {children}
      </div>
      {footer !== undefined && <div className="app-shell__footer">{footer}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  /** Visual hint about width — "auto" (default), "sm", "md", "lg", or "grow". */
  size?: "auto" | "sm" | "md" | "lg" | "grow";
}

export function ControlField({ label, children, size = "auto" }: FieldProps) {
  return (
    <label className={`app-shell__field app-shell__field--${size}`}>
      <span className="app-shell__field-label">{label}</span>
      <span className="app-shell__field-control">{children}</span>
    </label>
  );
}

interface RowProps {
  children: ReactNode;
  /** Optional second row (e.g. action buttons) shown to the right. */
  actions?: ReactNode;
}

export function ControlRow({ children, actions }: RowProps) {
  return (
    <div className="app-shell__control-row">
      <div className="app-shell__control-row-fields">{children}</div>
      {actions !== undefined && (
        <div className="app-shell__control-row-actions">{actions}</div>
      )}
    </div>
  );
}
