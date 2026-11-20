import { open, save } from "@tauri-apps/plugin-dialog";
import { Copy, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { api, type Model } from "../api";
import { useApp } from "../store";
import { cx, Modal, Btn } from "./ui";

const FILTER = [{ name: "Perfil do OpenShark", extensions: ["sharkprofile", "json"] }];

export function Profiles({ model }: { model: Model }) {
  const { snap, load, outcome, toast } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "delete" | "reset"; id: string }>(null);
  if (!snap) return null;
  const n = model.number;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      const r = await fn();
      if (r && (typeof r === "string" ? ["applied", "pending", "offline"].includes(r) : "error" in (r as object))) {
        outcome(r as never, ok);
      } else if (ok) toast("ok", ok);
    } catch (e) {
      toast("error", String(e));
    }
    await load();
  }

  async function exportProfile(id: string) {
    const p = snap!.profiles.find((x) => x.id === id);
    const path = await save({ filters: FILTER, defaultPath: `${p?.name ?? "perfil"}.sharkprofile` });
    if (path) await run(() => api.exportProfile(n, id, path), "Perfil exportado.");
  }

  async function importProfile() {
    const path = await open({ filters: FILTER, multiple: false });
    if (typeof path === "string") await run(() => api.importProfile(n, path), "Perfil importado.");
  }

  async function rename(id: string) {
    setEditing(null);
    const p = snap!.profiles.find((x) => x.id === id);
    if (!p || p.name === name.trim()) return;
    await run(() => api.renameProfile(n, id, name));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Perfis</h3>
        <div className="flex gap-0.5">
          <IconBtn title="Novo perfil" onClick={() => run(() => api.createProfile(n, "Perfil"))}>
            <Plus size={15} />
          </IconBtn>
          <IconBtn title="Importar perfil" onClick={importProfile}>
            <Upload size={15} />
          </IconBtn>
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
        {snap.profiles.map((p) => {
          const active = p.id === snap.active;
          return (
            <li key={p.id} className="group">
              <div
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                  active ? "border-accent/40 bg-accent/15 text-text" : "border-transparent text-text/80 hover:bg-hover",
                )}
                onClick={() => !active && run(() => api.activateProfile(n, p.id), `Perfil “${p.name}” ativado.`)}
              >
                <span className={cx("h-2 w-2 shrink-0 rounded-full", active ? "bg-accent" : "bg-line-2")} />
                {editing === p.id ? (
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-line bg-bg px-1.5 py-0.5 text-[13px] outline-none focus:border-accent"
                    value={name}
                    maxLength={32}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => rename(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(p.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name}</span>
                )}
                <div className="hidden gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                  <IconBtn title="Renomear" onClick={() => { setEditing(p.id); setName(p.name); }}>
                    <Pencil size={13} />
                  </IconBtn>
                  <IconBtn title="Duplicar" onClick={() => run(() => api.createProfile(n, p.name, p.id))}>
                    <Copy size={13} />
                  </IconBtn>
                  <IconBtn title="Exportar" onClick={() => exportProfile(p.id)}>
                    <Download size={13} />
                  </IconBtn>
                  <IconBtn title="Restaurar padrão" onClick={() => setConfirm({ kind: "reset", id: p.id })}>
                    <RotateCcw size={13} />
                  </IconBtn>
                  {snap.profiles.length > 1 && (
                    <IconBtn title="Excluir" onClick={() => setConfirm({ kind: "delete", id: p.id })}>
                      <Trash2 size={13} />
                    </IconBtn>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {confirm && (
        <Modal title={confirm.kind === "delete" ? "Excluir perfil" : "Restaurar padrão"} onClose={() => setConfirm(null)} width={400}>
          <p className="text-[13.5px] text-text/85">
            {confirm.kind === "delete"
              ? "Quer mesmo excluir este perfil?"
              : "Restaurar este perfil para os valores de fábrica? Botões, DPI e demais ajustes voltam ao padrão."}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn onClick={() => setConfirm(null)}>Cancelar</Btn>
            <Btn
              kind="danger"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c.kind === "delete") void run(() => api.deleteProfile(n, c.id), "Perfil excluído.");
                else void run(() => api.resetProfile(n, c.id), "Perfil restaurado.");
              }}
            >
              {confirm.kind === "delete" ? "Excluir" : "Restaurar"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text">
      {children}
    </button>
  );
}
