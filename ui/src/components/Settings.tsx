import { useApp } from "../store";
import { api, type Settings } from "../api";
import { Btn, Modal, Row, Toggle } from "./ui";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { snap, load, toast } = useApp();
  if (!snap) return null;

  async function set(next: Settings) {
    try {
      await api.setSettings(next);
      await load();
    } catch (e) {
      toast("error", String(e));
    }
  }

  return (
    <Modal title="Configurações" onClose={onClose} width={480}>
      <div className="divide-y divide-line">
        <Row label="Iniciar com o Windows" hint="Abre minimizado na bandeja ao entrar no Windows.">
          <Toggle checked={snap.settings.autostart} onChange={(v) => set({ ...snap.settings, autostart: v })} />
        </Row>
        <Row label="Fechar para a bandeja" hint="O X esconde a janela; o app continua acompanhando a bateria.">
          <Toggle checked={snap.settings.closeToTray} onChange={(v) => set({ ...snap.settings, closeToTray: v })} />
        </Row>
      </div>
      <div className="mt-5 rounded-xl border border-line bg-panel-2 p-4 text-[12.5px] leading-relaxed text-muted">
        <div className="mb-1 font-semibold text-text">OpenShark 0.1.0</div>
        Configurador não oficial, de código aberto, para mouses Attack Shark com o receptor 2.4G 1D57:FA60. Sem vínculo
        com a fabricante. Perfis e macros ficam em %APPDATA%\OpenShark.
      </div>
      <div className="mt-5 flex justify-between">
        <Btn kind="danger" onClick={() => api.quit()}>Sair do app</Btn>
        <Btn onClick={onClose}>Fechar</Btn>
      </div>
    </Modal>
  );
}
