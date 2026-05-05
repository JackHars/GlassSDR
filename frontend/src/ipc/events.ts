import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SpectrumFrame } from "./types/SpectrumFrame";
import type { AudioFrame } from "./types/AudioFrame";
import type { AppStatus } from "./types/AppStatus";

export function onSpectrum(handler: (frame: SpectrumFrame) => void): Promise<UnlistenFn> {
  return listen<SpectrumFrame>("spectrum", (e) => handler(e.payload));
}

export function onAudio(handler: (frame: AudioFrame) => void): Promise<UnlistenFn> {
  return listen<AudioFrame>("audio", (e) => handler(e.payload));
}

export function onAppStatus(handler: (s: AppStatus) => void): Promise<UnlistenFn> {
  return listen<AppStatus>("app_status", (e) => handler(e.payload));
}
