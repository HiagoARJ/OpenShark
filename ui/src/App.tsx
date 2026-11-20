import { CheckCircle2, Info, MousePointer2, TriangleAlert, Usb } from "lucide-react";
import { useEffect, useState } from "react";

import { DevicePanel } from "./components/DevicePanel";
import { Profiles } from "./components/Profiles";
import { SettingsModal } from "./components/Settings";
import { ThemeBackground } from "./components/ThemeBackground";
import { TitleBar } from "./components/TitleBar";
import { cx } from "./components/ui";
import { currentModel, subscribe, useApp } from "./store";
import { ButtonsTab } from "./tabs/Buttons";
import { DpiTab } from "./tabs/Dpi";
import { MacrosTab } from "./tabs/Macros";
import { PerformanceTab } from "./tabs/Performance";
import { PowerTab } from "./tabs/Power";

const TABS = [
  { id: "buttons", label: "Botões" },
  { id: "dpi", label: "DPI" },
  { id: "performance", label: "Desempenho" },
  { id: "power", label: "Energia" },
  { id: "macros", label: "Macros" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const { snap } = useApp();
  const [tab, setTab] = useState<TabId>(() => (new URLSearchParams(location.search).get("tab") as TabId) ?? "buttons");
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    void subscribe();
  }, []);

  const model = currentModel(snap);
  const status = snap?.status;

  return (
    <div className="relative z-[1] flex h-full flex-col">
      <TitleBar onSettings={() => setSettings(true)} />
      {!snap ? null : !model || !status ? (
        <Waiting receiver={status?.link === "wireless"} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="side glass z-20 flex w-[280px] shrink-0 flex-col border-r border-line bg-side">
            <DevicePanel model={model} status={status} />
            <Profiles model={model} />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <nav className="flex shrink-0 gap-1 border-b border-line px-6">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "tab relative px-4 py-3.5 text-[13.5px] font-medium transition-colors",
                    tab === t.id ? "tab-on text-text" : "text-muted hover:text-text",
                  )}
                >
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
              ))}
            </nav>
            <div key={tab} className="tab-in min-h-0 flex-1 overflow-auto p-6">
              {!model.supported ? (
                <Unsupported number={model.number} />
              ) : tab === "buttons" ? (
                <ButtonsTab model={model} />
              ) : tab === "dpi" ? (
                <DpiTab model={model} />
              ) : tab === "performance" ? (
                <PerformanceTab model={model} />
              ) : tab === "power" ? (
                <PowerTab model={model} />
              ) : (
                <MacrosTab />
              )}
            </div>
          </main>
        </div>
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      <Toasts />
      <ThemeBackground />
    </div>
  );
}

function Waiting({ receiver }: { receiver: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 hero text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
          {receiver ? <MousePointer2 size={34} className="text-accent-2" /> : <Usb size={34} className="text-accent-2" />}
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Bem-vindo ao OpenShark</h1>
        <p className="mt-2 text-[14px] text-muted">
          {receiver ? "Receptor 2.4G encontrado. Mexa o mouse para ele se identificar…" : "Procurando o mouse…"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted">
          Se demorar, confira se o receptor está no USB ou se o mouse está ligado no cabo, e se o botão de energia embaixo dele está ligado.
        </p>
      </div>
    </div>
  );
}

function Unsupported({ number }: { number: number }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-warn/40 bg-warn/5 p-5 text-[13.5px] leading-relaxed">
      <div className="mb-1 flex items-center gap-2 font-semibold text-warn">
        <TriangleAlert size={16} /> MS-{number} detectado
      </div>
      Este modelo usa codificações de DPI diferentes das já verificadas (família MS-11/14/15/16/17/18). Para não gravar
      valores errados no mouse, a edição fica desativada nele por enquanto; bateria e conexão continuam aparecendo.
    </div>
  );
}

function Toasts() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cx(
            "toast-in pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] shadow-2xl backdrop-blur",
            t.kind === "error" && "border-accent/50 bg-solid",
            t.kind === "ok" && "border-ok/40 bg-solid",
            t.kind === "info" && "border-line bg-solid",
          )}
        >
          {t.kind === "error" ? <TriangleAlert size={16} className="mt-px shrink-0 text-accent-2" /> : t.kind === "ok" ? <CheckCircle2 size={16} className="mt-px shrink-0 text-ok" /> : <Info size={16} className="mt-px shrink-0 text-muted" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
