import { Check, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { THEMES, type ThemeInfo, useTheme } from "../theme";
import { cx } from "./ui";

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('[title="Temas"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="modal theme-picker pop-in fixed right-3 top-12 z-40 max-h-[calc(100vh-64px)] w-[560px] overflow-auto rounded-2xl border border-line bg-solid p-4 shadow-2xl">
      <Group title="Clássicos" themes={THEMES.filter((t) => t.group === "classic")} />
      <Group title="Coleção" themes={THEMES.filter((t) => t.group === "collection")} icon />
    </div>
  );
}

function Group({ title, themes, icon }: { title: string; themes: ThemeInfo[]; icon?: boolean }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {icon && <Sparkles size={12} />} {title}
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {themes.map((t) => (
          <Tile key={t.id} info={t} />
        ))}
      </div>
    </div>
  );
}

function Tile({ info }: { info: ThemeInfo }) {
  const { theme, set } = useTheme();
  const active = theme === info.id;
  const p = info.preview;
  return (
    <button
      type="button"
      title={info.hint}
      onClick={(e) => set(info.id, { x: e.clientX, y: e.clientY })}
      className={cx(
        "group rounded-xl border p-1.5 text-left transition-all hover:-translate-y-0.5",
        active ? "border-accent bg-accent/10" : "border-line hover:border-line-2",
      )}
    >
      {/* Miniatura: uma janelinha com barra lateral, cartões e o destaque do tema. */}
      <div
        className={cx("relative h-[58px] overflow-hidden rounded-lg", info.animated && "preview-anim")}
        style={{ background: p.bg }}
      >
        <div className="absolute inset-y-1.5 left-1.5 w-5 rounded" style={{ background: p.panel }} />
        <div className="absolute left-9 right-1.5 top-1.5 h-4 rounded" style={{ background: p.panel }} />
        <div className="absolute bottom-1.5 left-9 h-5 w-10 rounded" style={{ background: p.panel }} />
        <div className="absolute bottom-3 right-2.5 h-1.5 w-9 rounded-full" style={{ background: p.accent }} />
        <div className="absolute left-[42px] top-[11px] h-1 w-7 rounded-full" style={{ background: p.text, opacity: 0.75 }} />
        {active && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate px-0.5 text-[12.5px] font-medium">{info.name}</div>
      <div className="px-0.5 text-[10.5px] leading-tight text-muted">{info.hint}</div>
    </button>
  );
}
