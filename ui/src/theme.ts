// Temas: as cores vivem em `styles.css` (`[data-theme="…"]`); aqui ficam a lista, a escolha salva
// e a troca com revelação circular (View Transitions) a partir do ponto do clique.
import { flushSync } from "react-dom";
import { create } from "zustand";

export interface ThemeInfo {
  id: string;
  name: string;
  hint: string;
  group: "classic" | "collection";
  /// A miniatura se move (fundo em gradiente).
  animated: boolean;
  /// Tema claro: controles nativos claros e palco escuro para o mouse branco.
  light?: boolean;
  /// Tem cenário atrás da interface (ThemeBackground.tsx).
  scene?: boolean;
  /// Fundo, painel e destaque da miniatura.
  preview: { bg: string; panel: string; accent: string; text: string };
}

export const THEMES: ThemeInfo[] = [
  { id: "shark", name: "Tubarão", hint: "O padrão", group: "classic", animated: false, preview: { bg: "#0d0d10", panel: "#1d1d22", accent: "#e2211c", text: "#ececef" } },
  { id: "ocean", name: "Oceano", hint: "Azul profundo", group: "classic", animated: false, preview: { bg: "#0a1018", panel: "#15212f", accent: "#1e9bff", text: "#e6eef7" } },
  { id: "emerald", name: "Esmeralda", hint: "Verde escuro", group: "classic", animated: false, preview: { bg: "#0b100d", panel: "#17211b", accent: "#19b36b", text: "#e8f1eb" } },
  { id: "amethyst", name: "Ametista", hint: "Roxo suave", group: "classic", animated: false, preview: { bg: "#0f0c15", panel: "#1e1929", accent: "#8b5cf6", text: "#eeeaf6" } },
  { id: "amoled", name: "AMOLED", hint: "Preto puro", group: "classic", animated: false, preview: { bg: "#000000", panel: "#141414", accent: "#ff5a1f", text: "#f2f2f2" } },
  { id: "light", name: "Claro", hint: "Para o dia", group: "classic", animated: false, preview: { bg: "#f3f4f7", panel: "#ffffff", accent: "#d91f1a", text: "#1b1c21" } },
  { id: "constellation", name: "Constelação", hint: "Partículas que seguem o cursor", group: "classic", animated: true, scene: true, preview: { bg: "radial-gradient(circle at 30% 30%,#1a1f52,#05060d 70%)", panel: "rgb(255 255 255 / .14)", accent: "#6d7dff", text: "#eceeff" } },
  { id: "chroma", name: "Chroma RGB", hint: "Destaque que percorre o arco-íris", group: "classic", animated: true, scene: true, preview: { bg: "conic-gradient(from 0deg,#ff004c,#ffb300,#2dff6a,#00c8ff,#8a2bff,#ff004c)", panel: "rgb(0 0 0 / .55)", accent: "#ffffff", text: "#ffffff" } },
  { id: "glass", name: "Liquid Glass", hint: "Vidro translúcido sobre manchas de cor", group: "collection", animated: true, light: true, scene: true, preview: { bg: "linear-gradient(135deg,#C9D6FF,#E2C9FF 45%,#FFD1DC)", panel: "rgb(255 255 255 / .55)", accent: "#4B3BFF", text: "#1B1740" } },
  { id: "aurora", name: "Aurora", hint: "Faixas de luz e gradientes animados", group: "collection", animated: true, scene: true, preview: { bg: "linear-gradient(120deg,#7C5CFF,#070B1A 45%,#22D3EE 80%,#34F5A4)", panel: "rgb(255 255 255 / .14)", accent: "#67E8F9", text: "#EEF1FF" } },
  { id: "ferrugem", name: "Ferrugem", hint: "Brasas pulsando em tons de cobre", group: "collection", animated: true, scene: true, preview: { bg: "linear-gradient(160deg,#1A0B06,#47180A 60%,#FF6A1A)", panel: "rgb(255 255 255 / .14)", accent: "#FF8A2B", text: "#FFF1E6" } },
  { id: "terminal", name: "Terminal Neon", hint: "Verde fósforo, grade e varredura", group: "collection", animated: false, scene: true, preview: { bg: "#070B08", panel: "#12241A", accent: "#39FF88", text: "#D7FFD9" } },
  { id: "bento", name: "Bento Claro", hint: "Blocos brancos e sombras macias", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#F1F1EC", panel: "#FFFFFF", accent: "#2F6BFF", text: "#17171A" } },
  { id: "brutal", name: "Neo-Brutal", hint: "Bordas grossas e sombra dura", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#FFE14D", panel: "#FFFFFF", accent: "#FF6FA3", text: "#111111" } },
  { id: "synthwave", name: "Synthwave", hint: "Sol listrado e grade neon", group: "collection", animated: true, scene: true, preview: { bg: "linear-gradient(180deg,#14042B,#5C1168 55%,#FF3D81)", panel: "rgb(255 255 255 / .14)", accent: "#3DF5FF", text: "#FDEBFF" } },
  { id: "papel", name: "Papel & Tinta", hint: "Editorial, serifa e vermelho de carimbo", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#F1E9D8", panel: "#FBF7EE", accent: "#B02A18", text: "#1D1A16" } },
  { id: "abissal", name: "Abissal", hint: "Fundo do mar bioluminescente", group: "collection", animated: true, scene: true, preview: { bg: "linear-gradient(180deg,#06324A,#031B2E 45%,#010810)", panel: "rgb(255 255 255 / .14)", accent: "#2CF6D0", text: "#E3FBFF" } },
  { id: "holo", name: "Holográfico", hint: "Folha furta-cor que muda de matiz", group: "collection", animated: true, light: true, scene: true, preview: { bg: "linear-gradient(90deg,#9AF0FF,#C9B6FF,#FFBDE6,#FFF1A6)", panel: "rgb(255 255 255 / .8)", accent: "#4A31C9", text: "#1A1530" } },
  { id: "argila", name: "Argila", hint: "Volumes fofos de massinha", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#E4DEFF", panel: "#F6F3FF", accent: "#6A4DF5", text: "#2B2350" } },
  { id: "noir", name: "Noir", hint: "Preto absoluto e um feixe de luz", group: "collection", animated: false, scene: true, preview: { bg: "#000000", panel: "#1A1A1A", accent: "#FAFAFA", text: "#FAFAFA" } },
  { id: "musgo", name: "Musgo", hint: "Formas orgânicas em verde e terracota", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#E6ECD8", panel: "#F8F9F0", accent: "#2F5D3A", text: "#1F2A1A" } },
  { id: "blueprint", name: "Blueprint", hint: "Planta de engenharia em cianótipo", group: "collection", animated: false, scene: true, preview: { bg: "#0B3D91", panel: "#08306F", accent: "#FFD23F", text: "#F2F7FF" } },
  { id: "deco", name: "Déco", hint: "Preto e ouro com raios girando", group: "collection", animated: false, scene: true, preview: { bg: "#0C0C0F", panel: "#1c1c22", accent: "#E6C26E", text: "#F5ECD7" } },
  { id: "gelo", name: "Gelo", hint: "Cristal azul-claro e neve caindo", group: "collection", animated: true, light: true, scene: true, preview: { bg: "linear-gradient(160deg,#F2FAFF,#D5EBFB 55%,#B9DBF5)", panel: "rgb(255 255 255 / .75)", accent: "#1A7FE0", text: "#0B2A45" } },
  { id: "pixel", name: "Pixel", hint: "8 bits: blocos, pixels e saltos", group: "collection", animated: false, scene: true, preview: { bg: "#1A1C2C", panel: "#29366F", accent: "#FFCD75", text: "#F4F4F4" } },
  { id: "memphis", name: "Memphis", hint: "Anos 80: formas soltas e bolinhas", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#FFF3DC", panel: "#FFFFFF", accent: "#FF7FA6", text: "#1A1A1A" } },
  { id: "relevo", name: "Relevo", hint: "Neumorfismo: tudo em alto-relevo", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#E6EAF0", panel: "#F4F6F9", accent: "#2458D6", text: "#2A3342" } },
  { id: "cosmos", name: "Cosmos", hint: "Estrelas piscando e órbitas douradas", group: "collection", animated: true, scene: true, preview: { bg: "radial-gradient(circle at 70% 20%,#2A1A66,#120A30 50%,#05030F)", panel: "rgb(255 255 255 / .14)", accent: "#F5C95B", text: "#F3EEFF" } },
  { id: "mesh", name: "Mesh", hint: "Malha de cores vivas com folha branca", group: "collection", animated: true, light: true, scene: true, preview: { bg: "linear-gradient(135deg,#5B2BFF,#C2185B 45%,#FF6A3D 75%,#00B8D9)", panel: "#FFFFFF", accent: "#5B2BFF", text: "#14121F" } },
  { id: "sakura", name: "Sakura", hint: "Pétalas caindo em rosa suave", group: "collection", animated: true, light: true, scene: true, preview: { bg: "linear-gradient(180deg,#FFF8F9,#FCE6EC 60%,#F9C6D4)", panel: "rgb(255 255 255 / .8)", accent: "#B5305F", text: "#3A2A30" } },
  { id: "turbo", name: "Turbo", hint: "Carbono, verde-limão e velocidade", group: "collection", animated: false, scene: true, preview: { bg: "#0D0E11", panel: "#1c1f26", accent: "#D7FF2F", text: "#F4F5F7" } },
  { id: "suico", name: "Suíço", hint: "Tipografia forte, preto, branco e vermelho", group: "collection", animated: false, light: true, scene: true, preview: { bg: "#FFFFFF", panel: "#EDEDED", accent: "#E10600", text: "#0A0A0A" } },
  { id: "lousa", name: "Lousa", hint: "Giz colorido no quadro-verde", group: "collection", animated: false, scene: true, preview: { bg: "#23402F", panel: "#2f5440", accent: "#F7E27C", text: "#F4F1E4" } },
];

const KEY = "shark-theme";

function stored(): string {
  const forced = new URLSearchParams(location.search).get("theme");
  if (forced && THEMES.some((t) => t.id === forced)) return forced;
  try {
    // "abyss" era o nome do tema Abissal numa versão anterior.
    const id = localStorage.getItem(KEY)?.replace(/^abyss$/, "abissal");
    if (id && THEMES.some((t) => t.id === id)) return id;
  } catch {
    // Sem armazenamento: fica o padrão.
  }
  return "shark";
}

/// Marca o <html>: `data-theme` escolhe o bloco de cores; `data-light`/`data-scene` ligam as regras
/// comuns dos temas claros e dos temas com cenário.
function mark(id: string) {
  const info = THEMES.find((t) => t.id === id);
  const root = document.documentElement;
  root.dataset.theme = id;
  root.toggleAttribute("data-light", !!info?.light);
  root.toggleAttribute("data-scene", !!info?.scene);
}

interface ThemeStore {
  theme: string;
  set: (id: string, origin?: { x: number; y: number }) => void;
}

export const useTheme = create<ThemeStore>((set, get) => ({
  theme: stored(),
  set: (id, origin) => {
    if (id === get().theme) return;
    const apply = () => {
      mark(id);
      set({ theme: id });
    };
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Só não lembra da escolha.
    }
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) return apply();
    root.style.setProperty("--vt-x", `${origin?.x ?? innerWidth / 2}px`);
    root.style.setProperty("--vt-y", `${origin?.y ?? 0}px`);
    document.startViewTransition(() => flushSync(apply));
  },
}));

/// Antes do primeiro render, para a janela já abrir no tema certo.
export function initTheme() {
  mark(useTheme.getState().theme);
}
