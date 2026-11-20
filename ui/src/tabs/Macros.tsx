import { ArrowDown, ArrowUp, Circle, Keyboard, Mouse, Move, Plus, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, type Macro, type MacroEvent } from "../api";
import { Btn, Card, cx, Modal, Segmented } from "../components/ui";
import { hidFromCode, hidFromMouse, keyName } from "../keys";
import { useApp } from "../store";

/// Bytes que a macro ocupa no mouse (cada slot guarda 98; até 4 slots por botão).
function macroBytes(events: MacroEvent[]) {
  return events.reduce((n, e) => n + (e.kind === "move" ? 6 : 2) + (e.delay >= 128 ? 2 : 0), 0);
}
const CAPACITY = 98 * 4;

function eventLabel(e: MacroEvent) {
  if (e.kind === "move") return `Mover cursor (${e.x}, ${e.y})`;
  return `${e.kind === "down" ? "Pressionar" : "Soltar"} ${keyName(e.key)}`;
}

export function MacrosTab() {
  const { snap, load, toast, outcome } = useApp();
  const macros = snap?.macros ?? [];
  const [selected, setSelected] = useState<string | null>(macros[0]?.id ?? null);
  const [work, setWork] = useState<Macro | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recording, setRecording] = useState(false);
  const [delayMode, setDelayMode] = useState<"real" | "fixed">("real");
  const [fixedDelay, setFixedDelay] = useState(20);
  const [row, setRow] = useState<number | null>(null);
  const [inserting, setInserting] = useState<null | "key" | "mouse" | "move">(null);
  const last = useRef<number>(0);

  useEffect(() => {
    const m = macros.find((x) => x.id === selected) ?? null;
    if (!dirty) setWork(m ? structuredClone(m) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, snap]);

  const change = (fn: (m: Macro) => void) => {
    setWork((w) => {
      if (!w) return w;
      const n = structuredClone(w);
      fn(n);
      return n;
    });
    setDirty(true);
  };

  // Gravação: teclado inteiro e botões do mouse dentro da área de gravação.
  useEffect(() => {
    if (!recording) return;
    const push = (kind: "down" | "up", key: number) => {
      const now = performance.now();
      change((m) => {
        if (m.events.length) {
          const prev = m.events[m.events.length - 1];
          prev.delay = delayMode === "real" ? Math.min(65000, Math.max(1, Math.round(now - last.current))) : fixedDelay;
        }
        m.events.push({ kind, key, delay: delayMode === "real" ? 10 : fixedDelay, x: 0, y: 0 });
      });
      last.current = now;
    };
    const down = (e: KeyboardEvent) => {
      const hid = hidFromCode(e.code);
      e.preventDefault();
      e.stopPropagation();
      if (hid != null && !e.repeat) push("down", hid);
    };
    const up = (e: KeyboardEvent) => {
      const hid = hidFromCode(e.code);
      e.preventDefault();
      e.stopPropagation();
      if (hid != null) push("up", hid);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    (window as unknown as { __macroMouse?: typeof push }).__macroMouse = push;
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      delete (window as unknown as { __macroMouse?: typeof push }).__macroMouse;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, delayMode, fixedDelay]);

  const mousePad = (kind: "down" | "up") => (e: React.MouseEvent) => {
    if (!recording) return;
    e.preventDefault();
    const hid = hidFromMouse(e.button);
    const push = (window as unknown as { __macroMouse?: (k: "down" | "up", key: number) => void }).__macroMouse;
    if (hid != null && push) push(kind, hid);
  };

  async function create() {
    const name = uniqueName(macros.map((m) => m.name));
    try {
      const [id] = await api.saveMacro({ id: "", name, events: [] });
      await load();
      setDirty(false);
      setSelected(id);
    } catch (e) {
      toast("error", String(e));
    }
  }

  async function saveWork() {
    if (!work) return;
    try {
      const [, o] = await api.saveMacro(work);
      setDirty(false);
      await load();
      if (o) outcome(o, "Macro salva e enviada ao mouse.");
      else toast("ok", "Macro salva.");
    } catch (e) {
      toast("error", String(e));
    }
  }

  async function remove(id: string) {
    await api.deleteMacro(id);
    setDirty(false);
    setSelected(null);
    await load();
  }

  const bytes = work ? macroBytes(work.events) : 0;

  return (
    <div className="grid h-full grid-cols-[230px_1fr] gap-4">
      <Card title="Macros" right={<Btn onClick={create} title="Nova macro"><Plus size={14} /></Btn>} className="flex min-h-0 flex-col">
        <ul className="-mx-2 min-h-0 flex-1 space-y-1 overflow-auto">
          {macros.length === 0 && <li className="px-2 text-[13px] text-muted">Nenhuma macro ainda.</li>}
          {macros.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setDirty(false);
                  setRecording(false);
                  setSelected(m.id);
                }}
                className={cx("flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[13.5px]", m.id === selected ? "border-accent/40 bg-accent/15" : "border-transparent hover:bg-hover")}
              >
                <span className="truncate">{m.name}</span>
                <span className="text-[11px] text-muted">{m.events.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {work ? (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              value={work.name}
              maxLength={24}
              onChange={(e) => change((m) => void (m.name = e.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[15px] font-medium outline-none focus:border-accent"
            />
            <Btn kind="primary" onClick={saveWork} disabled={!dirty || !work.name.trim()}>
              <Save size={14} /> Salvar
            </Btn>
            <Btn kind="danger" onClick={() => remove(work.id)} title="Excluir macro">
              <Trash2 size={14} />
            </Btn>
          </div>

          <div
            onMouseDown={mousePad("down")}
            onMouseUp={mousePad("up")}
            onContextMenu={(e) => recording && e.preventDefault()}
            className={cx(
              "flex items-center gap-4 rounded-xl border p-3.5 transition-colors",
              recording ? "border-accent bg-accent/10" : "border-line bg-panel",
            )}
          >
            <Btn kind={recording ? "danger" : "primary"} onClick={() => { last.current = performance.now(); setRecording((r) => !r); }}>
              {recording ? <><Square size={13} /> Parar</> : <><Circle size={13} className="fill-current" /> Gravar</>}
            </Btn>
            <div className="text-[12.5px] text-muted">
              {recording ? "Gravando: digite no teclado ou clique nesta faixa com os botões do mouse." : "A gravação captura teclado e cliques feitos nesta faixa."}
            </div>
            <div className="ml-auto flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
              <Segmented value={delayMode} onChange={setDelayMode} options={[{ value: "real", label: "Atrasos reais" }, { value: "fixed", label: "Atraso fixo" }]} />
              {delayMode === "fixed" && (
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={fixedDelay}
                  onChange={(e) => setFixedDelay(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-md border border-line bg-bg px-2 py-1 text-[13px] outline-none"
                />
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-solid text-left text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="w-32 px-3 py-2">Atraso (ms)</th>
                </tr>
              </thead>
              <tbody>
                {work.events.map((e, i) => (
                  <tr key={i} onClick={() => setRow(i)} className={cx("cursor-pointer border-t border-line/60", row === i ? "bg-accent/10" : "hover:bg-hover")}>
                    <td className="px-3 py-1.5 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <span className={cx("mr-2 inline-block w-2 text-center", e.kind === "down" ? "text-ok" : e.kind === "up" ? "text-accent-2" : "text-warn")}>
                        {e.kind === "down" ? "↓" : e.kind === "up" ? "↑" : "↔"}
                      </span>
                      {eventLabel(e)}
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="number"
                        min={1}
                        max={65000}
                        value={e.delay}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => change((m) => void (m.events[i].delay = Math.min(65000, Math.max(1, Number(ev.target.value) || 1))))}
                        className="w-24 rounded border border-transparent bg-transparent px-1.5 py-0.5 tabular-nums outline-none hover:border-line focus:border-accent focus:bg-bg"
                      />
                    </td>
                  </tr>
                ))}
                {work.events.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted">
                      Sem eventos. Grave ou insira ações abaixo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={() => setInserting("key")}><Keyboard size={14} /> Tecla</Btn>
            <Btn onClick={() => setInserting("mouse")}><Mouse size={14} /> Botão do mouse</Btn>
            <Btn onClick={() => setInserting("move")}><Move size={14} /> Mover cursor</Btn>
            <span className="mx-1 h-5 w-px bg-line" />
            <Btn disabled={row === null || row === 0} onClick={() => { change((m) => swap(m.events, row!, row! - 1)); setRow(row! - 1); }}><ArrowUp size={14} /></Btn>
            <Btn disabled={row === null || row >= work.events.length - 1} onClick={() => { change((m) => swap(m.events, row!, row! + 1)); setRow(row! + 1); }}><ArrowDown size={14} /></Btn>
            <Btn disabled={row === null} onClick={() => { change((m) => void m.events.splice(row!, 1)); setRow(null); }}><Trash2 size={14} /> Remover</Btn>
            <Btn disabled={!work.events.length} onClick={() => change((m) => void (m.events = []))}>Limpar tudo</Btn>
            <span className={cx("ml-auto text-xs tabular-nums", bytes > CAPACITY ? "text-accent-2" : "text-muted")}>
              {bytes > CAPACITY ? "Grande demais: o fim será cortado · " : ""}
              {bytes}/{CAPACITY} bytes
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-line text-muted">
          Crie uma macro para começar.
        </div>
      )}

      {inserting && work && (
        <InsertModal
          kind={inserting}
          onClose={() => setInserting(null)}
          onInsert={(evs) => {
            const at = row === null ? work.events.length : row + 1;
            change((m) => void m.events.splice(at, 0, ...evs));
            setInserting(null);
          }}
        />
      )}
    </div>
  );
}

function swap<T>(a: T[], i: number, j: number) {
  [a[i], a[j]] = [a[j], a[i]];
}

function uniqueName(names: string[]) {
  for (let i = 1; ; i++) {
    const n = `Macro ${i}`;
    if (!names.includes(n)) return n;
  }
}

function InsertModal({ kind, onInsert, onClose }: {
  kind: "key" | "mouse" | "move";
  onInsert: (e: MacroEvent[]) => void;
  onClose: () => void;
}) {
  const [key, setKey] = useState(kind === "mouse" ? 0xf1 : 0);
  const [action, setAction] = useState<"click" | "down" | "up">("click");
  const [delay, setDelay] = useState(20);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  useEffect(() => {
    if (kind !== "key") return;
    const onKey = (e: KeyboardEvent) => {
      const hid = hidFromCode(e.code);
      if (hid == null || e.key === "Escape") return;
      e.preventDefault();
      setKey(hid);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [kind]);

  function build(): MacroEvent[] {
    if (kind === "move") return [{ kind: "move", key: 0, delay, x, y }];
    if (action === "click")
      return [
        { kind: "down", key, delay, x: 0, y: 0 },
        { kind: "up", key, delay, x: 0, y: 0 },
      ];
    return [{ kind: action, key, delay, x: 0, y: 0 }];
  }

  const title = kind === "key" ? "Inserir tecla" : kind === "mouse" ? "Inserir botão do mouse" : "Inserir movimento";
  return (
    <Modal title={title} onClose={onClose} width={440}>
      {kind === "key" && (
        <div className="mb-4 rounded-xl border border-dashed border-accent/50 bg-accent/5 py-5 text-center text-lg font-semibold">
          {key ? keyName(key) : "Pressione uma tecla"}
        </div>
      )}
      {kind === "mouse" && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[0xf1, 0xf2, 0xf3, 0xf4, 0xf5].map((k) => (
            <button key={k} type="button" onClick={() => setKey(k)} className={cx("rounded-lg border px-2 py-2 text-[13px]", key === k ? "border-accent bg-accent/20" : "border-line bg-panel-2")}>
              {keyName(k)}
            </button>
          ))}
        </div>
      )}
      {kind === "move" ? (
        <div className="mb-4 flex gap-3">
          <label className="flex items-center gap-2 text-[13px]">X <input type="number" value={x} min={-32768} max={32767} onChange={(e) => setX(Number(e.target.value) || 0)} className="w-24 rounded-md border border-line bg-bg px-2 py-1 outline-none" /></label>
          <label className="flex items-center gap-2 text-[13px]">Y <input type="number" value={y} min={-32768} max={32767} onChange={(e) => setY(Number(e.target.value) || 0)} className="w-24 rounded-md border border-line bg-bg px-2 py-1 outline-none" /></label>
        </div>
      ) : (
        <div className="mb-4">
          <Segmented value={action} onChange={setAction} options={[{ value: "click", label: "Pressionar e soltar" }, { value: "down", label: "Só pressionar" }, { value: "up", label: "Só soltar" }]} />
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px]">
        Atraso depois
        <input type="number" min={1} max={65000} value={delay} onChange={(e) => setDelay(Math.max(1, Number(e.target.value) || 1))} className="w-24 rounded-md border border-line bg-bg px-2 py-1 outline-none" />
        ms
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="primary" disabled={kind !== "move" && !key} onClick={() => onInsert(build())}>
          Inserir
        </Btn>
      </div>
    </Modal>
  );
}
