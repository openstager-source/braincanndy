import type { FlipPoint } from "@/lib/scoring/engine";

const W = 520;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 34 };

export default function FlipChart({ points, current, maxRank, title }: { points: FlipPoint[]; current: number; maxRank: number; title: string }) {
  const maxX = points.length - 1 || 1;
  const x = (k: number) => PAD.l + (k / maxX) * (W - PAD.l - PAD.r);
  const y = (rank: number) => PAD.t + ((rank - 1) / Math.max(1, maxRank - 1)) * (H - PAD.t - PAD.b);
  const path = (key: "naiveRank" | "foolproofRank") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.fakes).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {Array.from({ length: maxRank }, (_, i) => i + 1).map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(r) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">#{r}</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25, 30].filter((k) => k <= maxX).map((k) => (
          <text key={k} x={x(k)} y={H - 14} textAnchor="middle" fontSize={11} fill="var(--muted)">{k}</text>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 1} textAnchor="middle" fontSize={11} fill="var(--muted)">fake reviews injected</text>
        <line x1={x(current)} x2={x(current)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" />
        <path d={path("naiveRank")} fill="none" stroke="var(--naive)" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={path("foolproofRank")} fill="none" stroke="var(--fool)" strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="6 3" />
      </svg>
      <figcaption className="legend">
        <span><i style={{ background: "var(--naive)" }} />Naive AI</span>
        <span><i style={{ background: "var(--fool)" }} />Foolproof</span>
        <span>Rank of the attacked place (#1 = top pick)</span>
      </figcaption>
    </figure>
  );
}
