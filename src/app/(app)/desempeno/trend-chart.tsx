import { fmtPct, type Light, type Thresholds, type TrendPoint } from "@/lib/metrics";

/** Gráfica de tendencia (SVG, sin librerías): barras de tareas entregadas y línea de puntualidad con las franjas del semáforo. */
export function TrendChart({ points, t }: { points: TrendPoint[]; t: Thresholds }) {
  if (points.length === 0) return <p className="meta">Sin datos para graficar.</p>;
  const W = 720, Hh = 220, L = 38, R = 12, T = 12, B = 34;
  const pw = W - L - R, ph = Hh - T - B;
  const step = pw / points.length;
  const maxN = Math.max(1, ...points.map((p) => p.kpis.delivered));
  const y = (pct: number) => T + ph - (pct / 100) * ph;
  const x = (i: number) => L + step * i + step / 2;
  const line = points.map((p, i) => (p.kpis.punctuality === null ? null : [x(i), y(p.kpis.punctuality)] as const));
  const path = line.reduce<string>((d, pt, i) => (pt ? `${d}${d && line[i - 1] ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)} ` : d), "");
  const labelEvery = Math.ceil(points.length / 12);
  const tone: Record<Light, string> = { green: "#34C759", amber: "#FF9500", red: "#FF3B30", none: "#C7C7CC" };
  return (
    <figure className="card space-y-2 p-4">
      <svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Tendencia de puntualidad y tareas entregadas" className="h-auto w-full">
        {/* franjas del semáforo */}
        <rect x={L} y={y(100)} width={pw} height={y(t.green) - y(100)} fill="#34C759" opacity="0.10" />
        <rect x={L} y={y(t.green)} width={pw} height={y(t.amber) - y(t.green)} fill="#FF9500" opacity="0.10" />
        <rect x={L} y={y(t.amber)} width={pw} height={y(0) - y(t.amber)} fill="#FF3B30" opacity="0.08" />
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.12" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">{v}%</text>
          </g>
        ))}
        {points.map((p, i) => {
          const bh = (p.kpis.delivered / maxN) * (ph * 0.45);
          return (
            <g key={i}>
              <rect x={x(i) - step * 0.28} y={T + ph - bh} width={step * 0.56} height={bh} rx="3" fill="#007AFF" opacity="0.28">
                <title>{`${p.label}: ${p.kpis.delivered} entregadas`}</title>
              </rect>
              {i % labelEvery === 0 && <text x={x(i)} y={Hh - 14} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">{p.label}</text>}
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => line[i] && (
          <circle key={i} cx={line[i]![0]} cy={line[i]![1]} r="4" fill={tone[p.kpis.punctuality === null ? "none" : p.kpis.punctuality >= t.green ? "green" : p.kpis.punctuality >= t.amber ? "amber" : "red"]} stroke="#fff" strokeWidth="1.5">
            <title>{`${p.label}: puntualidad ${fmtPct(p.kpis.punctuality)} (${p.kpis.onTime} de ${p.kpis.delivered} a tiempo)`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="meta flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-[#007AFF]/30" />Tareas entregadas</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-[#007AFF]" />Puntualidad proporcional (el color del punto sigue el semáforo)</span>
      </figcaption>
    </figure>
  );
}
