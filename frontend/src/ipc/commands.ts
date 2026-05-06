import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types/AppId";
import type { AppMetadata } from "./types/AppMetadata";
import type { NfmTuning } from "./types/NfmTuning";

export function listApps(): Promise<AppMetadata[]> {
  return invoke<AppMetadata[]>("list_apps");
}

export function startApp(id: AppId, params: unknown): Promise<void> {
  return invoke<void>("start_app", { id, params });
}

export function stopApp(): Promise<void> {
  return invoke<void>("stop_app");
}

export function startNfm(tuning: NfmTuning): Promise<void> {
  return startApp("nfm_audio" as AppId, tuning);
}

export interface AdsbParams {
  ref_lat?: number;
  ref_lon?: number;
  lna_gain_db?: number;
  vga_gain_db?: number;
}

export function startAdsb(params: AdsbParams = {}): Promise<void> {
  return startApp("adsb_rx" as AppId, params);
}
