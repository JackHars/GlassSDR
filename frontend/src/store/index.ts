import { create } from "zustand";
import type { AppId } from "../ipc/types/AppId";
import type { AppMetadata } from "../ipc/types/AppMetadata";
import type { AppStatus } from "../ipc/types/AppStatus";
import type { AircraftState } from "../ipc/types/AircraftState";
import type { PocsagTxStatus } from "../ipc/events";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "glasssdr-theme";

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch { /* ignore */ }
  return "dark";
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
}

interface State {
  apps: AppMetadata[];
  setApps: (a: AppMetadata[]) => void;

  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;

  activeApp: AppId | null;
  status: AppStatus;
  setStatus: (s: AppStatus) => void;
  setActiveApp: (id: AppId | null) => void;

  aircraft: Map<string, AircraftState>;
  upsertAircraft: (s: AircraftState) => void;
  clearAircraft: () => void;

  legalAccepted: boolean;
  armed: boolean;
  txStatus: PocsagTxStatus | null;
  setLegalAccepted: (v: boolean) => void;
  setArmed: (v: boolean) => void;
  setTxStatus: (s: PocsagTxStatus | null) => void;
}

export const useStore = create<State>((set, get) => ({
  apps: [],
  setApps: (apps) => set({ apps }),
  theme: typeof window !== "undefined" ? readStoredTheme() : "dark",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },
  activeApp: null,
  status: { kind: "idle" },
  setStatus: (status) => set({ status }),
  setActiveApp: (id) => set({ activeApp: id }),
  aircraft: new Map(),
  upsertAircraft: (s) =>
    set((state) => {
      const m = new Map(state.aircraft);
      m.set(s.icao24, s);
      return { aircraft: m };
    }),
  clearAircraft: () => set({ aircraft: new Map() }),
  legalAccepted: false,
  armed: false,
  txStatus: null,
  setLegalAccepted: (v) => set({ legalAccepted: v }),
  setArmed: (v) => set({ armed: v }),
  setTxStatus: (s) => set({ txStatus: s }),
}));
