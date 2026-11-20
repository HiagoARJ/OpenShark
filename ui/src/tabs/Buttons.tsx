import { ChevronRight, Keyboard, ListVideo, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Button, FuncGroup, MacroMode, Model } from "../api";
import { MouseArt } from "../components/MouseArt";
import { Btn, cx, Modal, Segmented } from "../components/ui";
import { hidFromCode, isModifier, MOD_ALT, MOD_CTRL, MOD_SHIFT, MOD_WIN, shortcutLabel } from "../keys";
import { useApp } from "../store";

const GROUPS: { id: FuncGroup; label: string }[] = [
  { id: "mouse", label: "Mouse" },
  { id: "dpi", label: "DPI" },
  { id: "media", label: "Multimídia" },
  { id: "browser", label: "Navegador" },
  { id: "system", label: "Sistema" },
  { id: "shortcut", label: "Atalhos" },
  { id: "special", label: "Especial" },
];

const LEFT_CLICK = 0x01;

export function ButtonsTab({ model }: { model: Model }) {
  const { draft, snap, edit, toast } = useApp();
  const [picking, setPicking] = useState<number | null>(null);
  const [shortcutFor, setShortcutFor] = useState<number | null>(null);
  const [macroFor, setMacroFor] = useState<number | null>(null);
  if (!draft || !snap) return null;

  function label(b: Button) {
    if (b.func === 0x10) return `Atalho: ${shortcutLabel(b.modifiers, b.key)}`;
    if (b.func === 0x11) {
      const m = snap!.macros.find((x) => x.id === b.macroId);
      return `Macro: ${m?.name ?? "(nenhuma)"}`;
    }
    return snap!.functions.find((f) => f.id === b.func)?.name ?? "Função do firmware";
  }

  function choose(slot: number, func: number) {
    if (func === 0x10) {
      setShortcutFor(slot);
    } else if (func === 0x11) {
      setMacroFor(slot);
    } else {
      // Algum botão visível precisa continuar sendo o clique esquerdo.
      const others = model.buttons.filter((s) => s !== slot).some((s) => draft!.buttons[s].func === LEFT_CLICK);
      if (func !== LEFT_CLICK && draft!.buttons[slot].func === LEFT_CLICK && !others) {
        toast("error", "Pelo menos um botão precisa ser “Clique esquerdo”.");
      } else {
        edit((p) => {
          p.buttons[slot] = { ...p.buttons[slot], func, macroId: null };
        }, 0);
      }
    }
    setPicking(null);
  }

  return (
    <div className="grid h-full grid-cols-[minmax(240px,1fr)_minmax(360px,1.25fr)] gap-6">
      <div className="relative flex items-center justify-center rounded-xl border border-line stage">
        <MouseArt buttons={model.buttons.length} className="max-h-[440px] max-w-[85%] drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="mb-1 text-xs text-muted">Os números seguem os marcadores da imagem. Clique para trocar a função.</p>
        {model.buttons.map((slot, i) => {
          const b = draft.buttons[slot];
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setPicking(slot)}
              className="card group flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 text-left transition-colors hover:border-accent/60 hover:bg-panel-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-on-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px]">{label(b)}</span>
              <ChevronRight size={16} className="text-muted group-hover:text-text" />
            </button>
          );
        })}
      </div>
      {picking !== null && (
        <FunctionPicker
          title={`Botão ${model.buttons.indexOf(picking) + 1}`}
          current={draft.buttons[picking].func}
          light={model.light}
          onPick={(f) => choose(picking, f)}
          onClose={() => setPicking(null)}
        />
      )}
      {shortcutFor !== null && (
        <ShortcutModal
          initial={draft.buttons[shortcutFor]}
          onClose={() => setShortcutFor(null)}
          onSave={(modifiers, key) => {
            const slot = shortcutFor;
            setShortcutFor(null);
            edit((p) => {
              p.buttons[slot] = { ...p.buttons[slot], func: 0x10, modifiers, key, macroId: null };
            }, 0);
          }}
        />
      )}
      {macroFor !== null && (
        <MacroAssignModal
          initial={draft.buttons[macroFor]}
          onClose={() => setMacroFor(null)}
          onSave={(macroId, macroMode, macroRepeat) => {
            const slot = macroFor;
            setMacroFor(null);
            edit((p) => {
              p.buttons[slot] = { ...p.buttons[slot], func: 0x11, macroId, macroMode, macroRepeat };
            }, 0);
          }}
        />
      )}
    </div>
  );
}

function FunctionPicker({ title, current, light, onPick, onClose }: {
  title: string;
  current: number;
  light: boolean;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const { snap } = useApp();
  const [q, setQ] = useState("");
  const list = useMemo(
    () => (snap?.functions ?? []).filter((f) => (light || f.id !== 0x17) && f.name.toLowerCase().includes(q.toLowerCase())),
    [snap, q, light],
  );
  return (
    <Modal title={title} onClose={onClose} width={620}>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
        <Search size={15} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar função" className="flex-1 bg-transparent text-[13.5px] outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {GROUPS.map((g) => {
          const items = list.filter((f) => f.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{g.label}</div>
              <div className="flex flex-col">
                {items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onPick(f.id)}
                    className={cx(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors",
                      f.id === current ? "bg-accent/20 text-text" : "text-text/85 hover:bg-hover",
                    )}
                  >
                    {f.id === 0x10 && <Keyboard size={14} className="text-muted" />}
                    {f.id === 0x11 && <ListVideo size={14} className="text-muted" />}
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ShortcutModal({ initial, onSave, onClose }: {
  initial: Button;
  onSave: (modifiers: number, key: number) => void;
  onClose: () => void;
}) {
  const [mods, setMods] = useState(initial.func === 0x10 ? initial.modifiers : 0);
  const [key, setKey] = useState(initial.func === 0x10 ? initial.key : 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hid = hidFromCode(e.code);
      if (hid == null || e.key === "Escape") return;
      e.preventDefault();
      if (isModifier(hid)) return;
      let m = 0;
      if (e.ctrlKey) m |= MOD_CTRL;
      if (e.shiftKey) m |= MOD_SHIFT;
      if (e.altKey) m |= MOD_ALT;
      if (e.metaKey) m |= MOD_WIN;
      setMods(m);
      setKey(hid);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const toggle = (bit: number) => setMods((m) => m ^ bit);
  return (
    <Modal title="Atalho personalizado" onClose={onClose} width={440}>
      <p className="text-[13px] text-muted">Pressione a combinação de teclas no teclado, ou marque os modificadores abaixo.</p>
      <div className="my-5 rounded-xl border border-dashed border-accent/50 bg-accent/5 py-6 text-center text-xl font-semibold tracking-wide">
        {shortcutLabel(mods, key)}
      </div>
      <div className="flex justify-center gap-2">
        {([
          [MOD_CTRL, "Ctrl"],
          [MOD_SHIFT, "Shift"],
          [MOD_ALT, "Alt"],
          [MOD_WIN, "Win"],
        ] as const).map(([bit, name]) => (
          <button
            key={bit}
            type="button"
            onClick={() => toggle(bit)}
            className={cx("rounded-lg border px-3 py-1.5 text-[13px]", mods & bit ? "border-accent bg-accent/20" : "border-line bg-panel-2 text-muted")}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="primary" disabled={!key} onClick={() => onSave(mods, key)}>
          Salvar
        </Btn>
      </div>
    </Modal>
  );
}

function MacroAssignModal({ initial, onSave, onClose }: {
  initial: Button;
  onSave: (id: string, mode: MacroMode, repeat: number) => void;
  onClose: () => void;
}) {
  const { snap } = useApp();
  const macros = snap?.macros ?? [];
  const [id, setId] = useState(initial.macroId ?? macros[0]?.id ?? "");
  const [mode, setMode] = useState<MacroMode>(initial.func === 0x11 ? initial.macroMode : "count");
  const [repeat, setRepeat] = useState(initial.func === 0x11 ? initial.macroRepeat : 1);
  return (
    <Modal title="Selecionar uma macro" onClose={onClose} width={480}>
      {macros.length === 0 ? (
        <p className="text-[13.5px] text-muted">Nenhuma macro criada ainda. Crie uma na aba “Macros” e volte aqui.</p>
      ) : (
        <>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">Lista de macros</div>
          <div className="max-h-52 overflow-auto rounded-lg border border-line">
            {macros.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setId(m.id)}
                className={cx("flex w-full items-center justify-between px-3 py-2 text-left text-[13.5px]", m.id === id ? "bg-accent/20" : "hover:bg-hover")}
              >
                <span>{m.name}</span>
                <span className="text-xs text-muted">{m.events.length} eventos</span>
              </button>
            ))}
          </div>
          <div className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">Reprodução</div>
          <Segmented<MacroMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "count", label: "Número de vezes" },
              { value: "untilKey", label: "Até apertar uma tecla" },
              { value: "whileHeld", label: "Enquanto segurar" },
            ]}
          />
          {mode === "count" && (
            <label className="mt-4 flex items-center gap-3 text-[13.5px]">
              Repetições
              <input
                type="number"
                min={1}
                max={255}
                value={repeat}
                onChange={(e) => setRepeat(Math.min(255, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-md border border-line bg-bg px-2 py-1 outline-none focus:border-accent"
              />
            </label>
          )}
        </>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="primary" disabled={!id} onClick={() => onSave(id, mode, repeat)}>
          Atribuir
        </Btn>
      </div>
    </Modal>
  );
}
