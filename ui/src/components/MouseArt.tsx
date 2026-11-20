// Arte do mouse visto de cima (`public/mouse.png`, desenho próprio do autor do projeto), com os
// marcadores numerados dos botões por cima. Os números seguem a ordem da lista da aba "Botões".

/// Tamanho da imagem, em pixels; os marcadores usam as mesmas coordenadas.
const W = 445;
const H = 810;

/// Posição de cada marcador: esquerdo, direito, rodinha, laterais (frente e trás), o botão abaixo
/// da rodinha e um extra que alguns modelos têm.
const MARKERS: [number, number][] = [
  [125, 180],
  [325, 180],
  [225, 165],
  [15, 300],
  [11, 409],
  [225, 293],
  [225, 440],
];

export function MouseArt({ buttons, className }: { buttons: number; className?: string }) {
  return (
    <svg viewBox={`-18 0 ${W + 36} ${H}`} className={className} role="img" aria-label="Mouse com os botões numerados">
      <image href="/mouse.png" x="0" y="0" width={W} height={H} />
      {MARKERS.slice(0, buttons).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y + 2.5} r="24" fill="#000000" opacity="0.25" />
          <circle cx={x} cy={y} r="24" fill="var(--color-accent)" />
          <text x={x} y={y + 10} textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--color-on-accent)" fontFamily="system-ui, sans-serif">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
