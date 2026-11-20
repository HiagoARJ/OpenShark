// Estado da interface: o snapshot do backend, edição otimista do perfil ativo e avisos.
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";

import { api, inTauri, type Model, type Outcome, outcomeError, type Profile, type Snapshot, type Status } from "./api";

export type Toast = { id: number; kind: "info" | "error" | "ok"; text: string };

interface AppStore {
  snap: Snapshot | null;
  /// Perfil ativo com as edições ainda não confirmadas pelo backend.
  draft: Profile | null;
  applying: boolean;
  toasts: Toast[];
  load: () => Promise<void>;
  setStatus: (s: Status) => void;
  edit: (fn: (p: Profile) => void, delay?: number) => void;
  outcome: (o: Outcome, okText?: string) => void;
  toast: (kind: Toast["kind"], text: string) => void;
  dismiss: (id: number) => void;
}

let saveTimer: number | undefined;
let toastSeq = 0;

export const useApp = create<AppStore>((set, get) => ({
  snap: null,
  draft: null,
  applying: false,
  toasts: [],

  load: async () => {
    const snap = await api.snapshot();
    const draft = snap.profiles.find((p) => p.id === snap.active) ?? null;
    set({ snap, draft: draft ? structuredClone(draft) : null });
  },

  setStatus: (status) => {
    const snap = get().snap;
    if (!snap) return;
    const modelChanged = snap.status.model !== status.model;
    set({ snap: { ...snap, status } });
    if (modelChanged) void get().load();
  },

  edit: (fn, delay = 250) => {
    const { draft, snap } = get();
    if (!draft || !snap?.status.model) return;
    const next = structuredClone(draft);
    fn(next);
    set({ draft: next });
    const model = snap.status.model;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      set({ applying: true });
      try {
        const outcome = await api.saveProfile(model, get().draft!);
        get().outcome(outcome);
      } catch (e) {
        get().toast("error", String(e));
      } finally {
        set({ applying: false });
        const fresh = await api.snapshot();
        set({ snap: fresh });
      }
    }, delay);
  },

  outcome: (o, okText) => {
    const err = outcomeError(o);
    if (err) get().toast("error", err);
    else if (o === "pending") get().toast("info", "Salvo. Mexa o mouse para ele acordar e receber as mudanças.");
    else if (o === "applied" && okText) get().toast("ok", okText);
  },

  toast: (kind, text) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, kind, text }].slice(-4) });
    window.setTimeout(() => get().dismiss(id), kind === "error" ? 7000 : 4000);
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function currentModel(snap: Snapshot | null): Model | null {
  if (!snap?.status.model) return null;
  return snap.models.find((m) => m.number === snap.status.model) ?? null;
}

/// Eventos do backend: estado do mouse, perfil alterado (sincronização, botão de DPI) e
/// resultado de aplicações pendentes.
let subscribed = false;

export async function subscribe() {
  if (subscribed) return;
  subscribed = true;
  const app = useApp.getState();
  if (!inTauri) return app.load();
  await listen<Status>("device://status", (e) => useApp.getState().setStatus(e.payload));
  await listen<number>("profile://changed", () => void useApp.getState().load());
  await listen<Outcome>("apply://result", (e) => useApp.getState().outcome(e.payload, "Mudanças pendentes aplicadas."));
  await app.load();
}
