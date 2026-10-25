import { useMemo, type CSSProperties } from "react";
import type { PlaceResult } from "@/lib/scoring/engine";
import { formatDate, timeline } from "@/lib/search/insights";

const W = 312;
const H = 92;
const GAP = 2;

/** Reviews per week for the last 26 weeks. A burst of set-aside reviews stands out at a glance. */
export default function ReviewTimeline({ place, now }: { place: PlaceResult; now: number }) {
  const bins = useMemo(() => timeline(place, now), [place, now]);
  const max = Math.max(1, ...bins.map((b) => b.clean + b.flagged));
  const bw = (W - GAP * (bins.length - 1)) / bins.length;
  const peak = bins.reduce((best, b, i) => (b.flagged > (bins[best]?.flagged ?? 0) ? i : best), 0);
  const peakBin = bins[peak]!;
  const setAside = bins.reduce((n, b) => n + b.flagged, 0);
  const counted = bins.reduce((n, b) => n + b.clean, 0);
  const showCallout = peakBin.flagged >= 3;
  const calloutX = Math.min(W - 4, Math.max(4, peak * (bw + GAP) + bw / 2));
  const anchor = calloutX > W - 60 ? "end" : calloutX < 60 ? "start" : "middle";

  const label = `Reviews per week over the last 26 weeks: ${counted} counted, ${setAside} set aside${showCallout ? `, ${peakBin.flagged} of them in the week of ${formatDate(peakBin.start)}` : ""}.`;
  return (
    <figure className="timeline">
      <svg viewBox={`0 -20 ${W} ${H + 38}`} role="img" aria-label={label}>
        {bins.map((b, i) => {
          const x = i * (bw + GAP);
          const hc = (b.clean / max) * H;
          const hf = (b.flagged / max) * H;
          return (
            <g key={b.start} className="bar" style={{ "--i": i } as CSSProperties}>
              {b.clean > 0 && <rect x={x} y={H - hc} width={bw} height={hc} rx="2" fill="var(--teal)" />}
              {b.flagged > 0 && <rect x={x} y={H - hc - hf} width={bw} height={hf} rx="2" fill="var(--coral)" />}
            </g>
          );
        })}
        <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--line)" />
        {showCallout && (
          <text className="callout" x={calloutX} y={H - ((peakBin.clean + peakBin.flagged) / max) * H - 7} textAnchor={anchor}>
            {peakBin.flagged} in one week
          </text>
        )}
        <text className="axis" x="0" y={H + 17}>{formatDate(bins[0]!.start)}</text>
        <text className="axis" x={W} y={H + 17} textAnchor="end">This week</text>
      </svg>
      <figcaption className="legend">
        <span><i style={{ background: "var(--teal)" }} />Counted</span>
        <span><i style={{ background: "var(--coral)" }} />Set aside</span>
      </figcaption>
    </figure>
  );
}
