// Cenário dos temas animados, atrás de toda a interface (os painéis desses temas são translúcidos).
import { useEffect, useRef } from "react";

import { THEMES, useTheme } from "../theme";

/// Pseudoaleatório fixo: as bolhas e estrelas nascem sempre nos mesmos lugares.
function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function ThemeBackground() {
  const theme = useTheme((s) => s.theme);
  if (!THEMES.find((t) => t.id === theme)?.scene) return null;
  // Cenários próprios; os demais temas desenham o seu com CSS (themes.css) nestes <i>.
  const scene =
    theme === "abissal" ? <Abyss /> : theme === "synthwave" ? <Synthwave /> : theme === "constellation" ? <Constellation /> : theme === "chroma" ? <Chroma /> : (
      Array.from({ length: 8 }, (_, i) => <i key={i} />)
    );
  return (
    <div key={theme} className="scene pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {scene}
    </div>
  );
}

function Abyss() {
  return (
    <>
      <div className="abyss-glow" />
      <div className="abyss-rays">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ left: `${8 + i * 19}%`, animationDelay: `${-i * 2.3}s`, width: `${90 + rand(i + 1) * 120}px` }} />
        ))}
      </div>
      <svg className="abyss-shark" viewBox="0 0 200 80">
        <path d="M5 42 C30 20 80 14 120 24 L135 4 L142 26 C160 30 175 36 182 40 L198 22 L192 44 L198 62 L180 48 C150 60 90 66 50 56 L40 70 L36 54 C22 52 10 48 5 42Z" />
      </svg>
      {Array.from({ length: 22 }, (_, i) => {
        const size = 4 + rand(i + 10) * 12;
        return (
          <span
            key={i}
            className="abyss-bubble"
            style={{
              left: `${rand(i + 30) * 100}%`,
              width: size,
              height: size,
              animationDuration: `${9 + rand(i + 50) * 12}s`,
              animationDelay: `${-rand(i + 70) * 20}s`,
              ["--sway" as string]: `${(rand(i + 90) - 0.5) * 80}px`,
            }}
          />
        );
      })}
    </>
  );
}

function Synthwave() {
  return (
    <>
      <div className="synth-stars">
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} style={{ left: `${rand(i + 3) * 100}%`, top: `${rand(i + 40) * 48}%`, animationDelay: `${-rand(i + 80) * 4}s` }} />
        ))}
      </div>
      <div className="synth-sun" />
      <div className="synth-floor">
        <div className="synth-grid" />
      </div>
      <div className="synth-fade" />
    </>
  );
}

function Chroma() {
  return (
    <>
      <div className="chroma-wheel" />
      <div className="chroma-veil" />
    </>
  );
}

/// Partículas ligadas por linhas; as próximas do cursor se acendem e são puxadas de leve.
function Constellation() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: -999, y: -999 };
    const pts = Array.from({ length: 80 }, (_, i) => ({
      x: rand(i + 1),
      y: rand(i + 200),
      vx: (rand(i + 400) - 0.5) * 0.00035,
      vy: (rand(i + 600) - 0.5) * 0.00035,
      r: 0.8 + rand(i + 800) * 1.6,
    }));
    const resize = () => {
      const dpr = devicePixelRatio || 1;
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        let ax = a.x * w;
        let ay = a.y * h;
        const md = Math.hypot(ax - mouse.x, ay - mouse.y);
        const near = Math.max(0, 1 - md / 180);
        ax += (mouse.x - ax) * near * 0.08;
        ay += (mouse.y - ay) * near * 0.08;
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(ax - b.x * w, ay - b.y * h);
          if (d < 130) {
            ctx.strokeStyle = `rgba(140,155,255,${(1 - d / 130) * (0.16 + near * 0.5)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(200,208,255,${0.55 + near * 0.45})`;
        ctx.beginPath();
        ctx.arc(ax, ay, a.r + near * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!still && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const visible = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    resize();
    raf = requestAnimationFrame(frame);
    addEventListener("resize", resize);
    addEventListener("mousemove", move);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("mousemove", move);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return (
    <>
      <div className="constellation-glow" />
      <canvas ref={ref} className="h-full w-full" />
    </>
  );
}
