import { useEffect, useState } from "react";

import { dpiToIndex, indexToDpi, type Model } from "../api";
import { Card, ColorSwatch, cx, Slider } from "../components/ui";
import { useApp } from "../store";

function DpiInput({ value, onCommit }: { value: number; onCommit: (dpi: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text.replace(/\D/g, ""));
    if (n) onCommit(n);
    else setText(String(value));
  };
  return (
    <input
      value={text}
      inputMode="numeric"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-[92px] rounded-md border border-transparent bg-transparent text-right text-2xl font-semibold tabular-nums outline-none hover:border-line focus:border-accent focus:bg-bg"
    />
  );
}

export function DpiTab({ model }: { model: Model }) {
  const { draft, edit, snap } = useApp();
  // Valor do slider durante o arraste (o envio só acontece ao soltar).
  const [live, setLive] = useState<Record<number, number>>({});
  if (!draft) return null;
  const stages = draft.dpi.slice(0, model.dpiStages);
  const onMouse = snap?.status.dpiStage;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Clique num estágio para torná-lo o ativo. Até 10.000 DPI os passos são de 50; acima disso, de 100 (máximo 25.000).
        {onMouse ? ` O botão de DPI do mouse está no estágio ${onMouse}.` : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {stages.map((s, i) => {
          const active = draft.activeStage === i;
          const index = live[i] ?? s.index;
          return (
            <div
              key={i}
              onClick={() => !active && edit((p) => void (p.activeStage = i), 0)}
              className={cx(
                "card cursor-pointer rounded-xl border bg-panel p-4 transition-all",
                active ? "border-accent shadow-[0_0_0_1px_var(--color-accent),0_10px_30px_-12px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]" : "border-line hover:border-line-2",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cx("flex h-5 w-5 items-center justify-center rounded-full border-2", active ? "border-accent" : "border-line-2")}>
                    {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted">Estágio {i + 1}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ColorSwatch color={s.color} size={22} onChange={(c) => edit((p) => void (p.dpi[i].color = c), 400)} />
                </div>
              </div>
              <div className="flex items-baseline justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <DpiInput value={indexToDpi(index)} onCommit={(dpi) => edit((p) => void (p.dpi[i].index = dpiToIndex(dpi)), 0)} />
                <span className="text-xs text-muted">DPI</span>
              </div>
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <Slider
                  min={1}
                  max={350}
                  value={index}
                  onChange={(v) => setLive((l) => ({ ...l, [i]: v }))}
                  onCommit={(v) => {
                    setLive((l) => {
                      const { [i]: _, ...rest } = l;
                      return rest;
                    });
                    edit((p) => void (p.dpi[i].index = v), 0);
                  }}
                />
                {/* 10.000 DPI é o índice 200 de 350: os passos mudam de 50 para 100 ali. */}
                <div className="relative mt-1 h-4 text-[10.5px] text-muted">
                  <span className="absolute left-0">50</span>
                  <span className="absolute -translate-x-1/2" style={{ left: `${(199 / 349) * 100}%` }}>10.000</span>
                  <span className="absolute right-0">25.000</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Card title="Valores rápidos" hint="Um clique aplica o valor no estágio ativo.">
        <div className="flex flex-wrap gap-2">
          {[400, 800, 1200, 1600, 2400, 3200, 4000, 6400, 8000, 12000, 16000, 25000].map((dpi) => (
            <button
              key={dpi}
              type="button"
              onClick={() => edit((p) => void (p.dpi[p.activeStage].index = dpiToIndex(dpi)), 0)}
              className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-[13px] tabular-nums hover:border-accent/60"
            >
              {dpi.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
