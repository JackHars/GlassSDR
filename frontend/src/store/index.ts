import { create } from "zustand";
import type { AppId } from "../ipc/types/AppId";
import type { AppMetadata } from "../ipc/types/AppMetadata";
import type { AppStatus } from "../ipc/types/AppStatus";
import type { AircraftState } from "../ipc/types/AircraftState";
import type { PocsagTxStatus } from "../ipc/events";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "glasssdr-theme";
const PIN_KEY = "glasssdr-pinned";

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

function readStoredPins(): string[] {
  try {
    const v = localStorage.getItem(PIN_KEY);
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return [];
}

function writePins(ids: string[]) {
  try { localStorage.setItem(PIN_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
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

  pinnedApps: string[];
  togglePin: (id: string) => void;
  isPinned: (id: string) => boolean;
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
  pinnedApps: typeof window !== "undefined" ? readStoredPins() : [],
  togglePin: (id) =>
    set((state) => {
      const has = state.pinnedApps.includes(id);
      const next = has ? state.pinnedApps.filter((p) => p !== id) : [...state.pinnedApps, id];
      writePins(next);
      return { pinnedApps: next };
    }),
  isPinned: (id) => get().pinnedApps.includes(id),
}));
