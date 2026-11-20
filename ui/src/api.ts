// Tipos e chamadas do backend (`src-tauri/src/commands.rs`). Os nomes seguem o serde (camelCase).
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/// Fora do Tauri (Vite no navegador, capturas de teste) as chamadas vão para `mock.ts`.
export const inTauri = "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (inTauri) return tauriInvoke<T>(cmd, args);
  const { mockInvoke } = await import("./mock");
  return (await mockInvoke(cmd)) as T;
}

export type Link = "wireless" | "wired";

export interface Status {
  link: Link | null;
  model: number | null;
  awake: boolean;
  battery: number | null;
  charging: boolean;
  full: boolean;
  dpiStage: number | null;
}

export interface Model {
  number: number;
  code: number;
  wiredPid: number;
  supported: boolean;
  buttons: number[];
  defaultButtons: number[];
  dpiStages: number;
  light: boolean;
  lightModes: number;
  liftOff: boolean;
  debounce: boolean;
  ripple: boolean;
  angleSnap: boolean;
  motionSync: boolean;
  power: boolean;
  polling: boolean;
}

export type FuncGroup = "mouse" | "dpi" | "media" | "browser" | "system" | "shortcut" | "special";

export interface FuncInfo {
  id: number;
  name: string;
  group: FuncGroup;
}

export interface DpiStage {
  index: number;
  enabled: boolean;
  color: [number, number, number];
}

export interface Light {
  mode: number;
  brightness: number;
  speed: number;
  color: [number, number, number];
}

export type MacroMode = "count" | "untilKey" | "whileHeld";

export interface Button {
  func: number;
  key: number;
  modifiers: number;
  macroId: string | null;
  macroMode: MacroMode;
  macroRepeat: number;
}

export interface Profile {
  id: string;
  name: string;
  dpi: DpiStage[];
  activeStage: number;
  polling: number;
  liftOff: number;
  ripple: boolean;
  angleSnap: boolean;
  motionSync: boolean;
  light: Light;
  sleepMinutes: number;
  deepSleep: number;
  debounce: number;
  buttons: Button[];
}

export type MacroKind = "down" | "up" | "move";

export interface MacroEvent {
  kind: MacroKind;
  key: number;
  delay: number;
  x: number;
  y: number;
}

export interface Macro {
  id: string;
  name: string;
  events: MacroEvent[];
}

export interface Settings {
  autostart: boolean;
  closeToTray: boolean;
}

export interface Snapshot {
  status: Status;
  models: Model[];
  functions: FuncInfo[];
  profiles: Profile[];
  active: string;
  macros: Macro[];
  settings: Settings;
  pending: boolean;
  syncing: boolean;
}

export type Outcome = "applied" | "pending" | "offline" | { error: string };

export type OsdEvent =
  | { type: "status"; code: number; battery: number; charging: boolean; full: boolean }
  | { type: "dpiStage"; code: number; stage: number }
  | { type: "polling"; code: number; polling: number }
  | { type: "ack"; code: number; ok: boolean }
  | { type: "lightMode"; code: number; mode: number }
  | { type: "other"; code: number; kind: number; value: number };

export const api = {
  snapshot: (model?: number) => invoke<Snapshot>("snapshot", { model: model ?? null }),
  saveProfile: (model: number, profile: Profile) => invoke<Outcome>("save_profile", { model, profile }),
  activateProfile: (model: number, id: string) => invoke<Outcome>("activate_profile", { model, id }),
  createProfile: (model: number, name: string, copyOf?: string) =>
    invoke<string>("create_profile", { model, name, copyOf: copyOf ?? null }),
  renameProfile: (model: number, id: string, name: string) => invoke<void>("rename_profile", { model, id, name }),
  deleteProfile: (model: number, id: string) => invoke<Outcome>("delete_profile", { model, id }),
  resetProfile: (model: number, id: string) => invoke<Outcome>("reset_profile", { model, id }),
  exportProfile: (model: number, id: string, path: string) => invoke<void>("export_profile", { model, id, path }),
  importProfile: (model: number, path: string) => invoke<string>("import_profile", { model, path }),
  readDevice: (model: number) => invoke<void>("read_device", { model }),
  saveMacro: (value: Macro) => invoke<[string, Outcome | null]>("save_macro", { value }),
  deleteMacro: (id: string) => invoke<void>("delete_macro", { id }),
  setSettings: (settings: Settings) => invoke<void>("set_settings", { settings }),
  quit: () => invoke<void>("quit"),
};

/// Índice do slider (1..=350) ↔ DPI, igual a `shark_proto::profile`.
export function indexToDpi(index: number): number {
  if (index <= 0) return 0;
  if (index <= 200) return index * 50;
  return 10000 + (index - 200) * 100;
}

export function dpiToIndex(dpi: number): number {
  const d = Math.min(25000, Math.max(50, Math.round(dpi)));
  if (d <= 10000) return Math.min(200, Math.max(1, Math.round(d / 50)));
  return Math.min(350, 200 + Math.round((d - 10000) / 100));
}

export const POLLING_HZ = [125, 250, 500, 1000];

export function outcomeError(o: Outcome): string | null {
  return typeof o === "object" ? o.error : null;
}
