import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Palette, Settings as Gear, X } from "lucide-react";
import { useState } from "react";

import { ThemePicker } from "./ThemePicker";

export function TitleBar({ onSettings }: { onSettings: () => void }) {
  const win = { minimize: () => getCurrentWindow().minimize(), close: () => getCurrentWindow().close() };
  const [themes, setThemes] = useState(() => new URLSearchParams(location.search).has("picker"));
  return (
    <header data-tauri-drag-region className="flex h-11 shrink-0 items-center justify-between chrome glass z-30 border-b border-line bg-chrome pl-4">
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <img src="/brand.svg" alt="" className="h-5 w-5" draggable={false} />
        <span data-tauri-drag-region className="text-[13px] font-semibold tracking-wide">
          OPEN<span className="text-accent-2">SHARK</span>
        </span>
      </div>
      <div className="flex h-full items-center">
        <button
          className={"flex h-full w-11 items-center justify-center hover:bg-hover hover:text-text " + (themes ? "text-accent-2" : "text-muted")}
          title="Temas"
          onClick={() => setThemes((v) => !v)}
        >
          <Palette size={16} />
        </button>
        {themes && <ThemePicker onClose={() => setThemes(false)} />}
        <button className="flex h-full w-11 items-center justify-center text-muted hover:bg-hover hover:text-text" title="Configurações" onClick={onSettings}>
          <Gear size={16} />
        </button>
        <button className="flex h-full w-11 items-center justify-center text-muted hover:bg-hover hover:text-text" title="Minimizar" onClick={() => win.minimize()}>
          <Minus size={16} />
        </button>
        <button className="flex h-full w-12 items-center justify-center text-muted hover:bg-accent hover:text-on-accent" title="Fechar" onClick={() => win.close()}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
