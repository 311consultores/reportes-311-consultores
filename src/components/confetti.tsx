"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE", "#FF2D55"];

/** Lluvia de confeti sobre toda la pantalla (unos 4 segundos). No se muestra si la persona pidió menos animaciones. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.6,
      s: 6 + Math.random() * 8,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy: 2 + Math.random() * 4,
      vx: -2 + Math.random() * 4,
      r: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = t > 3000 ? Math.max(0, 1 - (t - 3000) / 1000) : 1;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 4000) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60]" />;
}
