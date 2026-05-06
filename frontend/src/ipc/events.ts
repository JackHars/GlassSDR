import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SpectrumFrame } from "./types/SpectrumFrame";
import type { AudioFrame } from "./types/AudioFrame";
import type { AppStatus } from "./types/AppStatus";
import type { AircraftState } from "./types/AircraftState";

export function onSpectrum(handler: (frame: SpectrumFrame) => void): Promise<UnlistenFn> {
  return listen<SpectrumFrame>("spectrum", (e) => handler(e.payload));
}

export function onAudio(handler: (frame: AudioFrame) => void): Promise<UnlistenFn> {
  return listen<AudioFrame>("audio", (e) => handler(e.payload));
}

export function onAppStatus(handler: (s: AppStatus) => void): Promise<UnlistenFn> {
  return listen<AppStatus>("app_status", (e) => handler(e.payload));
}

export function onAircraftState(handler: (s: AircraftState) => void): Promise<UnlistenFn> {
  return listen<AircraftState>("aircraft_state", (e) => handler(e.payload));
}

export interface PocsagTxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

export function onPocsagTxStatus(handler: (s: PocsagTxStatus) => void): Promise<UnlistenFn> {
  return listen<PocsagTxStatus>("pocsag_tx_status", (e) => handler(e.payload));
}

export function onTxStatus(handler: (s: PocsagTxStatus) => void): Promise<UnlistenFn> {
  return listen<PocsagTxStatus>("tx_status", (e) => handler(e.payload));
}
