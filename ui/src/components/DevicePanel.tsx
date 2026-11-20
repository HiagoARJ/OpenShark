import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Cable, Moon, RefreshCw, Wifi } from "lucide-react";

import { api, type Model, type Status } from "../api";
import { useApp } from "../store";
import { MouseArt } from "./MouseArt";
import { cx } from "./ui";

function BatteryIcon({ s }: { s: Status }) {
  if (s.charging) return <BatteryCharging size={16} className="text-ok" />;
  const b = s.battery ?? 0;
  if (b >= 70) return <BatteryFull size={16} className="text-ok" />;
  if (b >= 30) return <BatteryMedium size={16} className="text-warn" />;
  return <BatteryLow size={16} className="text-accent-2" />;
}

export function DevicePanel({ model, status }: { model: Model; status: Status }) {
  const { applying, snap, toast, load } = useApp();
  const wired = status.link === "wired";
  const asleep = !wired && !status.awake;
  const battery = status.full ? 100 : status.battery;

  async function resync() {
    try {
      await api.readDevice(model.number);
      await load();
      toast("ok", "Configuração lida do mouse.");
    } catch (e) {
      toast("error", String(e));
    }
  }

  return (
    <div className="border-b border-line p-4">
      <div className="stage-mini relative mx-auto flex h-[210px] items-center justify-center rounded-xl">
        <div className="absolute inset-x-6 bottom-2 h-10 rounded-[50%] bg-accent/15 blur-2xl" />
        <MouseArt buttons={model.buttons.length} className={cx("relative h-full transition-opacity", asleep && "opacity-50")} />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">Attack Shark</div>
          <div className="display text-xl font-semibold">MS-{model.number}</div>
        </div>
        <button className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text" title="Ler configuração do mouse" onClick={resync}>
          <RefreshCw size={15} className={cx(snap?.syncing && "animate-spin")} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1">
          {wired ? <Cable size={13} /> : <Wifi size={13} />}
          {wired ? "Cabo USB" : "Receptor 2.4G"}
        </span>
        {asleep ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1 text-muted">
            <Moon size={13} /> Dormindo
          </span>
        ) : (
          battery != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1">
              <BatteryIcon s={status} />
              {status.charging ? `Carregando · ${battery}%` : `${battery}%`}
            </span>
          )
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span
          className={cx(
            "h-2 w-2 rounded-full",
            applying || snap?.syncing ? "pulse bg-warn" : snap?.pending ? "bg-warn" : asleep ? "bg-muted" : "bg-ok",
          )}
        />
        {applying
          ? "Aplicando…"
          : snap?.syncing
            ? "Sincronizando com o mouse…"
            : snap?.pending
              ? "Mudanças aguardando o mouse acordar"
              : asleep
                ? "Mexa o mouse para acordá-lo"
                : "Sincronizado"}
      </div>
    </div>
  );
}
