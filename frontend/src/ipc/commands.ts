import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types/AppId";
import type { AppMetadata } from "./types/AppMetadata";
import type { NfmTuning } from "./types/NfmTuning";
import type { RecordingFormat } from "./types/RecordingFormat";
import type { RecordingMeta } from "./types/RecordingMeta";

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

export function acceptTxLegal(): Promise<void> {
  return invoke<void>("accept_tx_legal");
}

export function armTx(): Promise<void> {
  return invoke<void>("arm_tx");
}

export function disarmTx(): Promise<void> {
  return invoke<void>("disarm_tx");
}

export interface UsbDevice {
  id: string;
  name: string;
  vendor_id: number;
  product_id: number;
  is_hackrf: boolean;
}

export function listUsbDevices(): Promise<UsbDevice[]> {
  return invoke<UsbDevice[]>("list_usb_devices");
}

export function startRecording(
  appId: AppId,
  format: RecordingFormat,
  centerHz?: number,
): Promise<string> {
  return invoke<string>("start_recording", { appId, format, centerHz: centerHz ?? null });
}

export function stopRecording(): Promise<RecordingMeta> {
  return invoke<RecordingMeta>("stop_recording");
}

export function listRecordings(appId?: AppId): Promise<RecordingMeta[]> {
  return invoke<RecordingMeta[]>("list_recordings", { appId: appId ?? null });
}

export function deleteRecording(path: string): Promise<void> {
  return invoke<void>("delete_recording", { path });
}
