// Backend simulado para abrir a interface no navegador (Vite) sem o Tauri: usado nas capturas de
// tela de teste. Parâmetros na URL: `?tab=dpi`, `?state=asleep|none|receiver|wired|unsupported`.
import type { FuncInfo, Macro, Model, Profile, Snapshot } from "./api";

const params = new URLSearchParams(location.search);
const state = params.get("state") ?? "awake";

const model15: Model = {
  number: 15, code: 14, wiredPid: 0x212c, supported: true, buttons: [0, 1, 2, 5, 4],
  defaultButtons: [1, 2, 3, 6, 5, 4, 0x34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xc, 0xb],
  dpiStages: 6, light: false, lightModes: 7, liftOff: false, debounce: true, ripple: true,
  angleSnap: true, motionSync: false, power: true, polling: true,
};

const functions: FuncInfo[] = [
  [1, "Clique esquerdo", "mouse"], [2, "Clique direito", "mouse"], [3, "Botão do meio", "mouse"],
  [4, "Avançar", "mouse"], [5, "Voltar", "mouse"], [9, "Clique duplo", "mouse"], [10, "Botão de disparo", "mouse"],
  [0x0b, "Rolar para cima", "mouse"], [0x0c, "Rolar para baixo", "mouse"], [6, "Ciclo de DPI", "dpi"],
  [7, "DPI +", "dpi"], [8, "DPI −", "dpi"], [0x41, "Reproduzir / pausar", "media"], [0x45, "Volume +", "media"],
  [0x46, "Volume −", "media"], [0x47, "Mudo", "media"], [0x55, "Atualizar", "browser"], [0x58, "Calculadora", "system"],
  [0x21, "Copiar", "shortcut"], [0x22, "Colar", "shortcut"], [0x32, "Captura de tela", "shortcut"],
  [0x10, "Atalho personalizado", "special"], [0x11, "Macro", "special"], [0, "Desativado", "special"],
].map(([id, name, group]) => ({ id, name, group }) as FuncInfo);

const colors: [number, number, number][] = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255], [255, 64, 0], [255, 255, 255]];

function profile(id: string, name: string): Profile {
  return {
    id, name,
    dpi: [16, 32, 48, 64, 160, 350, 0, 0].map((index, i) => ({ index, enabled: i < 6, color: colors[i] })),
    activeStage: 1, polling: 3, liftOff: 0, ripple: true, angleSnap: false, motionSync: true,
    light: { mode: 0, brightness: 8, speed: 6, color: [0, 255, 0] },
    sleepMinutes: 1, deepSleep: 10, debounce: 4,
    buttons: model15.defaultButtons.map((func) => ({ func, key: 0, modifiers: 0, macroId: null, macroMode: "count", macroRepeat: 1 })),
  };
}

const macros: Macro[] = [
  {
    id: "m1", name: "Copiar e colar",
    events: [
      { kind: "down", key: 0xe0, delay: 15, x: 0, y: 0 }, { kind: "down", key: 0x06, delay: 40, x: 0, y: 0 },
      { kind: "up", key: 0x06, delay: 12, x: 0, y: 0 }, { kind: "up", key: 0xe0, delay: 250, x: 0, y: 0 },
      { kind: "down", key: 0xf1, delay: 30, x: 0, y: 0 }, { kind: "up", key: 0xf1, delay: 30, x: 0, y: 0 },
    ],
  },
  { id: "m2", name: "Rajada", events: [] },
];

const profiles = [profile("p1", "Perfil 1"), profile("p2", "Jogos FPS"), profile("p3", "Trabalho")];
profiles[0].buttons[4].func = 0x11;
profiles[0].buttons[4].macroId = "m1";

const models: Model[] = Array.from({ length: 18 }, (_, i) => ({ ...model15, number: i + 1, supported: [11, 14, 15, 16, 17, 18].includes(i + 1) }));

export function mockSnapshot(): Snapshot {
  const number = state === "unsupported" ? 3 : 15;
  const none = state === "none" || state === "receiver";
  return {
    status: {
      link: state === "none" ? null : state === "wired" ? "wired" : "wireless",
      model: none ? null : number,
      awake: state !== "asleep",
      battery: state === "asleep" ? null : 87,
      charging: false,
      full: false,
      dpiStage: 2,
    },
    models, functions,
    profiles: none ? [] : profiles,
    active: none ? "" : "p1",
    macros,
    settings: { autostart: false, closeToTray: true },
    pending: false,
    syncing: false,
  };
}

export async function mockInvoke(cmd: string): Promise<unknown> {
  switch (cmd) {
    case "snapshot": return mockSnapshot();
    case "save_profile": case "activate_profile": return "applied";
    case "save_macro": return ["m1", null];
    default: return null;
  }
}
