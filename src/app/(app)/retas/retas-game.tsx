"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { startRun, submitScore, type RetasState } from "@/app/actions/retas";
import {
  NOPAL_BIG, NOPAL_PALETTE, NOPAL_SMALL, TLACUACHE_DEAD, TLACUACHE_DUCK, TLACUACHE_JUMP, TLACUACHE_PALETTE, TLACUACHE_RUN_A, TLACUACHE_RUN_B,
  ZOPILOTE_A, ZOPILOTE_B, ZOPILOTE_PALETTE,
} from "./sprites";

const W = 800;
const H = 220;
const GROUND = 188; // y del suelo
const S = 3; // escala de los sprites (cada píxel del dibujo = 3 px)

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

/** Dibuja un sprite de píxeles en un canvas aparte (una sola vez) para pintarlo rápido en cada cuadro. */
function makeSprite(rows: string[], palette: Record<string, string>): Sprite {
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w * S;
  c.height = rows.length * S;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = palette[ch];
      if (col) { g.fillStyle = col; g.fillRect(x * S, y * S, S, S); }
    });
  });
  return { canvas: c, w: c.width, h: c.height };
}

type Obstacle = { x: number; y: number; w: number; h: number; sprites: Sprite[]; flap?: boolean; hit: { dx: number; dy: number; w: number; h: number } };

/** El juego de Las Retas: un tlacuache corre por el campo; salta (espacio, ↑ o toque) y se agacha (↓) para esquivar nopales y zopilotes. */
export function RetasGame({ bestMonth, bestAll, onState }: { bestMonth: number; bestAll: number; onState: (s: RetasState) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "over">("idle");
  const [lastScore, setLastScore] = useState(0);
  const [message, setMessage] = useState<string>();
  const api = useRef<{ jump: () => void; duck: (v: boolean) => void; start: () => void }>({ jump: () => {}, duck: () => {}, start: () => {} });
  const bests = useRef({ month: bestMonth, all: bestAll });
  bests.current = { month: Math.max(bests.current.month, bestMonth), all: Math.max(bests.current.all, bestAll) };

  const finish = useCallback(async (score: number, token: string | null) => {
    setLastScore(score);
    setPhase("over");
    if (!token || score < 1) return;
    const r = await submitScore(token, score);
    if (r.error) return setMessage(r.error);
    if (r.state) onState(r.state);
    if (r.newAllBest) { bests.current.all = score; setMessage("🏆 ¡Nuevo récord de siempre!"); }
    else if (r.newMonthBest) { bests.current.month = score; setMessage("⭐ ¡Nuevo récord del mes!"); }
    else setMessage(undefined);
  }, [onState]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const run = [makeSprite(TLACUACHE_RUN_A, TLACUACHE_PALETTE), makeSprite(TLACUACHE_RUN_B, TLACUACHE_PALETTE)];
    const jumpS = makeSprite(TLACUACHE_JUMP, TLACUACHE_PALETTE);
    const duckS = [makeSprite(TLACUACHE_DUCK, TLACUACHE_PALETTE)];
    const deadS = makeSprite(TLACUACHE_DEAD, TLACUACHE_PALETTE);
    const nopalS = makeSprite(NOPAL_SMALL, NOPAL_PALETTE);
    const nopalB = makeSprite(NOPAL_BIG, NOPAL_PALETTE);
    const bird = [makeSprite(ZOPILOTE_A, ZOPILOTE_PALETTE), makeSprite(ZOPILOTE_B, ZOPILOTE_PALETTE)];

    // Estado de la partida
    let state: "idle" | "running" | "over" = "idle";
    let token: string | null = null;
    let tokenReady = false;
    let y = 0; // altura sobre el suelo (positivo = en el aire)
    let vy = 0;
    let ducking = false;
    let speed = 6;
    let distance = 0;
    let frame = 0;
    let nextSpawn = 400;
    let obstacles: Obstacle[] = [];
    let clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 220 + 40, y: 30 + (i % 3) * 22 }));
    let pebbles = Array.from({ length: 18 }, (_, i) => ({ x: i * 47, w: 2 + (i % 3) * 2, y: GROUND + 6 + (i % 3) * 5 }));
    let overAt = 0;
    let raf = 0;
    let last = 0;
    let flash = 0;
    const px = 40; // x del tlacuache

    const reset = () => {
      y = 0; vy = 0; ducking = false; speed = 6; distance = 0; frame = 0; nextSpawn = 420; obstacles = []; flash = 0;
    };
    const score = () => Math.floor(distance / 12);

    const begin = () => {
      if (state === "running") return;
      if (state === "over" && performance.now() - overAt < 600) return; // evita reiniciar sin querer
      reset();
      state = "running";
      setPhase("running");
      setMessage(undefined);
      token = null;
      tokenReady = false;
      startRun().then((r) => { token = r.token; tokenReady = true; }).catch(() => { tokenReady = true; });
    };
    const jump = () => {
      if (state !== "running") return begin();
      if (y === 0) vy = -13.2;
    };
    api.current = { jump, duck: (v) => { ducking = v; if (v && state !== "running") begin(); }, start: begin };

    const spawn = () => {
      const r = Math.random();
      const ground = GROUND;
      if (score() > 160 && r > 0.72) {
        const high = Math.random() > 0.5; // alto: hay que agacharse; bajo: hay que saltar
        const s = bird[0];
        obstacles.push({ x: W + 20, y: high ? ground - 62 - s.h : ground - 30 - s.h, w: s.w, h: s.h, sprites: bird, flap: true, hit: { dx: 6, dy: 6, w: s.w - 12, h: s.h - 14 } });
      } else if (r > 0.38) {
        obstacles.push({ x: W + 20, y: ground - nopalB.h, w: nopalB.w, h: nopalB.h, sprites: [nopalB], hit: { dx: 6, dy: 4, w: nopalB.w - 12, h: nopalB.h - 4 } });
      } else {
        const two = score() > 90 && Math.random() > 0.5;
        const w = two ? nopalS.w * 2 + 6 : nopalS.w;
        obstacles.push({ x: W + 20, y: ground - nopalS.h, w, h: nopalS.h, sprites: two ? [nopalS, nopalS] : [nopalS], hit: { dx: 5, dy: 4, w: w - 10, h: nopalS.h - 4 } });
      }
      nextSpawn = distance + 300 + speed * 22 + Math.random() * 260;
    };

    const fg = () => getComputedStyle(canvas).color || "#111";

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const color = fg();
      // nubes y suelo
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      for (const c of clouds) { ctx.fillRect(c.x, c.y, 54, 8); ctx.fillRect(c.x + 10, c.y - 8, 30, 8); }
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, GROUND + 3, W, 2);
      ctx.globalAlpha = 0.3;
      for (const p of pebbles) ctx.fillRect(p.x, p.y, p.w, 2);
      ctx.globalAlpha = 1;
      // obstáculos
      for (const o of obstacles) {
        const sp = o.flap ? o.sprites[Math.floor(t / 140) % 2] : null;
        if (sp) ctx.drawImage(sp.canvas, o.x, o.y);
        else { let ox = o.x; for (const s of o.sprites) { ctx.drawImage(s.canvas, ox, o.y); ox += s.w + 6; } }
      }
      // tlacuache
      const spr = state === "over" ? deadS : y > 0 ? jumpS : ducking ? duckS[0] : run[Math.floor(frame / 6) % 2];
      const dyDraw = GROUND - spr.h - y;
      if (state !== "running" || flash <= 0 || Math.floor(flash / 4) % 2 === 0) ctx.drawImage(spr.canvas, px, dyDraw);
      // marcador
      ctx.fillStyle = color;
      ctx.font = "bold 16px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.globalAlpha = 0.9;
      ctx.fillText(String(score()).padStart(5, "0"), W - 14, 26);
      ctx.globalAlpha = 0.5;
      ctx.fillText(`MES ${String(bests.current.month).padStart(5, "0")}  ·  MÁX ${String(bests.current.all).padStart(5, "0")}`, W - 14, 48);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      if (state === "idle") {
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText("Presiona ESPACIO o toca para empezar", W / 2, 96);
        ctx.font = "14px system-ui, sans-serif";
        ctx.globalAlpha = 0.7;
        ctx.fillText("↑ salta · ↓ agacha", W / 2, 120);
        ctx.globalAlpha = 1;
      } else if (state === "over") {
        ctx.font = "bold 26px system-ui, sans-serif";
        ctx.fillText("¡Te alcanzó el campo!", W / 2, 88);
        ctx.font = "15px system-ui, sans-serif";
        ctx.globalAlpha = 0.75;
        ctx.fillText("Espacio o toque para reintentar", W / 2, 114);
        ctx.globalAlpha = 1;
      }
    };

    const step = (now: number) => {
      const dtMs = Math.min(now - (last || now), 50);
      last = now;
      const f = dtMs / (1000 / 60);
      if (state === "running") {
        frame += f;
        speed = Math.min(13, speed + 0.0016 * f);
        distance += speed * f;
        // salto y caída
        if (y > 0 || vy < 0) {
          vy += (ducking && y > 0 ? 2.4 : 0.78) * f;
          y -= vy * f;
          if (y <= 0) { y = 0; vy = 0; }
        }
        if (score() > 0 && score() % 100 === 0 && flash <= 0) flash = 24;
        if (flash > 0) flash -= f;
        // mover mundo
        for (const o of obstacles) o.x -= speed * f;
        obstacles = obstacles.filter((o) => o.x + o.w > -40);
        for (const c of clouds) { c.x -= speed * 0.15 * f; if (c.x < -80) c.x = W + 20; }
        for (const p of pebbles) { p.x -= speed * f; if (p.x < -10) p.x += W + 40; }
        if (distance >= nextSpawn) spawn();
        // colisión (cajas un poco más chicas que los dibujos)
        const spr = y > 0 ? jumpS : ducking ? duckS[0] : run[0];
        const me = { x: px + 8, y: GROUND - spr.h - y + 6, w: spr.w - 22, h: spr.h - 10 };
        for (const o of obstacles) {
          const ob = { x: o.x + o.hit.dx, y: o.y + o.hit.dy, w: o.hit.w, h: o.hit.h };
          if (me.x < ob.x + ob.w && me.x + me.w > ob.x && me.y < ob.y + ob.h && me.y + me.h > ob.y) {
            state = "over";
            overAt = performance.now();
            const s = score();
            const wait = async () => { for (let i = 0; i < 20 && !tokenReady; i++) await new Promise((r) => setTimeout(r, 100)); void finish(s, token); };
            void wait();
            break;
          }
        }
      }
      draw(now);
      raf = requestAnimationFrame(step);
    };

    const onKey = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) {
        const t = e.target as HTMLElement;
        if (t && /input|textarea|select/i.test(t.tagName)) return;
        e.preventDefault();
      }
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { if (!e.repeat) jump(); }
      if (e.code === "ArrowDown" || e.code === "KeyS") ducking = true;
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "ArrowDown" || e.code === "KeyS") ducking = false; };
    const onVis = () => { last = 0; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [finish]);

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        aria-label="Juego Las Retas: el tlacuache corre y esquiva nopales y zopilotes"
        className="w-full touch-none select-none rounded-2xl border border-black/10 bg-white text-zinc-800 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={() => api.current.jump()}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="btn-outline flex-1 justify-center py-3 sm:hidden" onPointerDown={(e) => { e.preventDefault(); api.current.jump(); }}><ArrowUp size={18} /> Saltar</button>
        <button type="button" className="btn-outline flex-1 justify-center py-3 sm:hidden" onPointerDown={(e) => { e.preventDefault(); api.current.duck(true); }} onPointerUp={() => api.current.duck(false)} onPointerLeave={() => api.current.duck(false)} onPointerCancel={() => api.current.duck(false)}><ArrowDown size={18} /> Agacharse</button>
        <p className="meta hidden text-xs sm:block">Teclado: <b>Espacio</b> o <b>↑</b> para saltar, <b>↓</b> para agacharte (en el aire, caes más rápido). En celular: toca la pantalla o usa los botones.</p>
        {phase === "over" && <p className="ml-auto text-sm font-semibold">Puntaje: {lastScore}</p>}
      </div>
      {message && <p role="status" className="rounded-xl bg-[#FF9500]/10 px-4 py-2 text-sm font-medium text-[#B25E00] dark:text-[#FFB340]">{message}</p>}
    </div>
  );
}
