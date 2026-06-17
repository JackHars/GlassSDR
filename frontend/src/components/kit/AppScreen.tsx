import { ReactNode, CSSProperties } from "react";
import { getAppTheme, type AllAppId } from "../../theme/appThemes";
import "./AppScreen.css";

export type AppStatus = "idle" | "acquiring" | "live" | "error" | "empty";

interface AppScreenProps {
  appId: AllAppId;
  title: string;
  subtitle?: string;
  status?: AppStatus;
  statusText?: string;
  actions?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  fillBody?: boolean;
}

const STATUS_LABELS: Record<AppStatus, string> = {
  idle: "Idle",
  acquiring: "Acquiring",
  live: "Live",
  error: "Error",
  empty: "No data",
};

export function AppScreen({
  appId,
  title,
  subtitle,
  status = "idle",
  statusText,
  actions,
  controls,
  children,
  footer,
  fillBody = true,
}: AppScreenProps) {
  const theme = getAppTheme(appId);

  const cssVars: CSSProperties = {
    "--accent": theme.accent,
    "--accent-hover": theme.accentHover,
    "--accent-glow": theme.accentGlow,
    "--accent-dim": theme.accentDim,
    "--ambient-1": theme.ambient[0],
    "--ambient-2": theme.ambient[1],
  } as CSSProperties;

  return (
    <div
      className="app-screen"
      data-app={appId}
      data-motif={theme.motif}
      data-status={status}
      style={cssVars}
    >
      {/* Ambient tint layer — softly colours the glass-bg mesh for this app */}
      <div className="app-screen__ambient" aria-hidden />

      <div className="app-screen__header">
        <div className="app-screen__title-block">
          <h2 className="app-screen__title">{title}</h2>
          {subtitle && <span className="app-screen__subtitle">{subtitle}</span>}
        </div>
        <div className="app-screen__header-right">
          <StatusPill status={status} text={statusText ?? STATUS_LABELS[status]} />
          {actions && <div className="app-screen__actions">{actions}</div>}
        </div>
      </div>

      {controls && (
        <div className="app-screen__controls">{controls}</div>
      )}

      <div className={`app-screen__body${fillBody ? " app-screen__body--fill" : ""}`}>
        {children}
      </div>

      {footer && <div className="app-screen__footer">{footer}</div>}
    </div>
  );
}

interface StatusPillProps {
  status: AppStatus;
  text: string;
}

function StatusPill({ status, text }: StatusPillProps) {
  return (
    <div className="app-screen__status-pill" data-status={status}>
      <span className="app-screen__status-dot" />
      <span className="app-screen__status-text">{text}</span>
    </div>
  );
}
