import { useState } from "react";

import { type Model, POLLING_HZ } from "../api";
import { Card, Row, Segmented, Slider, Toggle } from "../components/ui";
import { useApp } from "../store";

export function PerformanceTab({ model }: { model: Model }) {
  const { draft, edit } = useApp();
  const [debounce, setDebounce] = useState<number | null>(null);
  if (!draft) return null;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {model.polling && (
        <Card title="Taxa de polling" hint="Quantas vezes por segundo o mouse informa a posição ao computador.">
          <Segmented
            value={draft.polling}
            onChange={(v) => edit((p) => void (p.polling = v), 0)}
            options={POLLING_HZ.map((hz, i) => ({ value: i, label: `${hz} Hz` }))}
          />
          <p className="mt-3 text-xs text-muted">
            {draft.polling === 3
              ? "1000 Hz: menor latência, consome um pouco mais de bateria."
              : "Taxas menores economizam bateria."}
          </p>
        </Card>
      )}
      <Card title="Atributos do mouse">
        <div className="divide-y divide-line">
          {model.ripple && (
            <Row label="Controle de ondulação" hint="Suaviza a trepidação do sensor em DPIs altos.">
              <Toggle checked={draft.ripple} onChange={(v) => edit((p) => void (p.ripple = v), 0)} />
            </Row>
          )}
          {model.angleSnap && (
            <Row label="Correção de linha (angle snap)" hint="Endireita movimentos quase retos.">
              <Toggle checked={draft.angleSnap} onChange={(v) => edit((p) => void (p.angleSnap = v), 0)} />
            </Row>
          )}
          {model.motionSync && (
            <Row label="Motion sync" hint="Sincroniza a leitura do sensor com o polling.">
              <Toggle checked={draft.motionSync} onChange={(v) => edit((p) => void (p.motionSync = v), 0)} />
            </Row>
          )}
          {model.liftOff && (
            <Row label="Distância de levantamento">
              <Segmented value={draft.liftOff} onChange={(v) => edit((p) => void (p.liftOff = v), 0)} options={[{ value: 0, label: "1 mm" }, { value: 1, label: "2 mm" }]} />
            </Row>
          )}
        </div>
      </Card>
      {model.debounce && (
        <Card title="Tempo de resposta das teclas" hint="Debounce dos cliques: valores menores respondem mais rápido, maiores evitam cliques duplos.">
          <div className="flex items-center gap-4">
            <Slider
              min={2}
              max={25}
              value={debounce ?? draft.debounce}
              onChange={setDebounce}
              onCommit={(v) => {
                setDebounce(null);
                edit((p) => void (p.debounce = v), 0);
              }}
            />
            <span className="w-14 text-right text-lg font-semibold tabular-nums">{debounce ?? draft.debounce} ms</span>
          </div>
        </Card>
      )}
    </div>
  );
}
