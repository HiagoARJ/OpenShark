// Peças visuais reaproveitadas pelas abas.
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ title, hint, children, right, className }: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("card glass rounded-xl border border-line bg-panel p-4", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text/90">{title}</h3>}
            {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-accent" : "bg-track",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Slider({ value, min, max, step = 1, onChange, onCommit, disabled }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  disabled?: boolean;
}) {
  const fill = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <input
      type="range"
      className="slider w-full"
      style={{ ["--fill" as string]: `${fill}%` }}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
    />
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg inline-flex rounded-lg border border-line bg-panel-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "whitespace-nowrap rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            o.value === value ? "seg-on bg-accent text-on-accent shadow" : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <div className="min-w-0">
        <div className="text-[13.5px]">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, kind = "ghost", disabled, title, className }: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        `btn btn-${kind}`,
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40",
        kind === "primary" && "bg-accent text-on-accent hover:bg-accent-2",
        kind === "ghost" && "border border-line bg-panel-2 text-text hover:border-line-2 hover:bg-panel",
        kind === "danger" && "border border-accent/40 bg-accent/10 text-accent-2 hover:bg-accent/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function rgbHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ColorSwatch({ color, onChange, size = 28 }: {
  color: [number, number, number];
  onChange: (c: [number, number, number]) => void;
  size?: number;
}) {
  return (
    <label
      className="relative inline-block cursor-pointer rounded-md border border-line-2 shadow-inner"
      style={{ width: size, height: size, background: rgbHex(color) }}
      title="Cor"
    >
      <input
        type="color"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={rgbHex(color)}
        onChange={(e) => onChange(hexRgb(e.target.value))}
      />
    </label>
  );
}

export function Modal({ title, onClose, children, width = 460 }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="max-h-[86vh] modal pop-in overflow-auto rounded-2xl border border-line bg-solid shadow-2xl" style={{ width }}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button className="rounded-md p-1 text-muted hover:bg-hover hover:text-text" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
