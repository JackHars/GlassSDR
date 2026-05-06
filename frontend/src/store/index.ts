import { create } from "zustand";
import type { AppId } from "../ipc/types/AppId";
import type { AppMetadata } from "../ipc/types/AppMetadata";
import type { AppStatus } from "../ipc/types/AppStatus";
import type { AircraftState } from "../ipc/types/AircraftState";

interface State {
  apps: AppMetadata[];
  setApps: (a: AppMetadata[]) => void;

  activeApp: AppId | null;
  status: AppStatus;
  setStatus: (s: AppStatus) => void;
  setActiveApp: (id: AppId | null) => void;

  aircraft: Map<string, AircraftState>;
  upsertAircraft: (s: AircraftState) => void;
  clearAircraft: () => void;
}

export const useStore = create<State>((set) => ({
  apps: [],
  setApps: (apps) => set({ apps }),
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
}));
