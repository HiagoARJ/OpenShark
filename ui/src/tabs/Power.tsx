import { BatteryCharging, Moon, Zap } from "lucide-react";
import { useState } from "react";

import type { Model, Profile } from "../api";
import { Card, ColorSwatch, Row, Slider } from "../components/ui";
import { useApp } from "../store";

const LIGHT_MODES = [
  "Desligado",
  "Estático",
  "Respiração",
  "Neon",
  "Respiração colorida",
  "DPI estático",
  "DPI respiração",
  "Onda arco-íris",
];

export function PowerTab({ model }: { model: Model }) {
  const { draft, edit, snap } = useApp();
  const [live, setLive] = useState<{ sleep?: number; deep?: number; bright?: number; speed?: number }>({});
  if (!draft || !snap) return null;
  const s = snap.status;
  const battery = s.full ? 100 : s.battery;

  const commit = (key: keyof typeof live, apply: (p: Profile, v: number) => void) => (v: number) => {
    setLive((l) => ({ ...l, [key]: undefined }));
    edit((p) => apply(p, v), 0);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Bateria">
        {s.link === "wired" ? (
          <p className="text-[13.5px] text-muted">Ligado no cabo: a bateria só aparece pelo receptor 2.4G.</p>
        ) : battery == null ? (
          <p className="text-[13.5px] text-muted">Aguardando o mouse informar a bateria (ele manda a cada poucos segundos quando está acordado).</p>
        ) : (
          <div>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-semibold tabular-nums">{battery}%</span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                {s.charging ? <><BatteryCharging size={16} className="text-ok" /> Carregando</> : s.full ? <><Zap size={16} className="text-ok" /> Carga completa</> : "Na bateria"}
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-track">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${battery}%`, background: battery < 20 ? "var(--color-accent)" : battery < 50 ? "var(--color-warn)" : "var(--color-ok)" }}
              />
            </div>
          </div>
        )}
      </Card>
      {model.power && (
        <Card title="Gestão de energia" hint="Depois desse tempo parado, o mouse entra em economia; mexer ou clicar acorda.">
          <Row label="Sono" hint="Tempo sem uso até dormir">
            <div className="w-56">
              <Slider
                min={1}
                max={60}
                value={live.sleep ?? draft.sleepMinutes}
                onChange={(v) => setLive((l) => ({ ...l, sleep: v }))}
                onCommit={commit("sleep", (p, v) => void (p.sleepMinutes = v))}
              />
            </div>
            <span className="w-14 text-right tabular-nums">{live.sleep ?? draft.sleepMinutes} min</span>
          </Row>
          <Row label="Sono profundo" hint="Tempo até o modo de menor consumo">
            <div className="w-56">
              <Slider
                min={1}
                max={60}
                value={live.deep ?? draft.deepSleep}
                onChange={(v) => setLive((l) => ({ ...l, deep: v }))}
                onCommit={commit("deep", (p, v) => void (p.deepSleep = v))}
              />
            </div>
            <span className="w-14 text-right tabular-nums">{live.deep ?? draft.deepSleep} min</span>
          </Row>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Moon size={13} /> Enquanto dorme, o mouse não recebe configurações; o app guarda e envia quando ele acordar.
          </p>
        </Card>
      )}
      {model.light && (
        <Card title="Iluminação">
          <Row label="Efeito">
            <select
              value={draft.light.mode}
              onChange={(e) => edit((p) => void (p.light.mode = Number(e.target.value)), 0)}
              className="rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] outline-none"
            >
              {LIGHT_MODES.slice(0, Math.max(1, model.lightModes)).map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Brilho">
            <div className="w-56">
              <Slider min={1} max={8} value={live.bright ?? draft.light.brightness} onChange={(v) => setLive((l) => ({ ...l, bright: v }))} onCommit={commit("bright", (p, v) => void (p.light.brightness = v))} />
            </div>
          </Row>
          <Row label="Velocidade">
            <div className="w-56">
              <Slider min={4} max={8} value={live.speed ?? draft.light.speed} onChange={(v) => setLive((l) => ({ ...l, speed: v }))} onCommit={commit("speed", (p, v) => void (p.light.speed = v))} />
            </div>
          </Row>
          <Row label="Cor">
            <ColorSwatch color={draft.light.color} onChange={(c) => edit((p) => void (p.light.color = c), 400)} />
          </Row>
        </Card>
      )}
    </div>
  );
}
