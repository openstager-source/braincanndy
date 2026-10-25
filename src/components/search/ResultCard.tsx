"use client";

import { useRef, type AnimationEvent, type CSSProperties, type PointerEvent } from "react";
import { motionAllowed } from "@/lib/motion";
import type { Ranked } from "@/lib/scoring/engine";
import { campaignShape, whyLine, type RankMode } from "@/lib/search/insights";
import PlaceArt from "./PlaceArt";

interface Props {
  place: Ranked;
  index: number;
  mode: RankMode;
  /** Places up (+) or down (−) versus the raw-star order. */
  shift: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ResultCard({ place, index, mode, shift, selected, onSelect }: Props) {
  const r = place.restaurant;
  const shape = campaignShape(place);
  const frame = useRef(0);

  // A gentle 3D tilt of the picture toward the pointer (mouse only, and only with motion on).
  const tilt = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || frame.current || !motionAllowed()) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--rx", `${((clientX - b.left) / b.width - 0.5) * 12}deg`);
      el.style.setProperty("--ry", `${(0.5 - (clientY - b.top) / b.height) * 12}deg`);
    });
  };
  const untilt = (e: PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    e.currentTarget.style.removeProperty("--rx");
    e.currentTarget.style.removeProperty("--ry");
  };
  // The entrance plays once. Without this, reordering (which re-inserts nodes) would replay it.
  const entered = (e: AnimationEvent<HTMLLIElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.style.animation = "none";
  };

  const dishes = r.dishes.filter((d) => d !== "cafe").slice(0, 3).join(", ");
  return (
    <li className="result" data-key={r.id} style={{ "--i": index } as CSSProperties} onAnimationEnd={entered}>
      <article className={`result-hit${selected ? " on" : ""}`} onPointerMove={tilt} onPointerLeave={untilt}>
        <PlaceArt place={r} className="art-tilt" />
        <div className="result-body">
          <div className="result-top">
            <span className="rank" aria-label={`Rank ${place.rank}`}>{place.rank}</span>
            <h3>
              <button id={`hit-${r.id}`} type="button" className="hit" aria-expanded={selected} aria-controls="place-panel" onClick={() => onSelect(r.id)}>
                {r.name}
              </button>
            </h3>
            {place.rank === 1 && mode === "trust" && <span className="badge best">Most trusted</span>}
            {shape === "boost" && <span className="badge warn">Suspicious signals</span>}
            {shape === "smear" && <span className="badge smear">Smear caught</span>}
          </div>
          <p className="meta">{r.area} · ₹{r.priceForOne} for one{dishes ? ` · ${dishes}` : ""}</p>
          <div className="scores">
            <span className={`rate ${mode === "trust" ? "trust" : "dim"}`}>{place.trustRating.toFixed(1)}★<small>trust</small></span>
            <span className={`rate ${mode === "raw" ? "lead" : "dim"}`}>{place.naiveRating.toFixed(1)}★<small>raw stars</small></span>
            <span className="rate dim">{place.reviewCount}<small>reviews</small></span>
            {mode === "trust" && shift !== 0 && (
              <span className={`shift ${shift > 0 ? "up" : "down"}`}>{shift > 0 ? `▲ ${shift}` : `▼ ${-shift}`} vs raw stars</span>
            )}
          </div>
          <p className={`why${shape === "boost" ? " alert" : shape === "smear" ? " good" : ""}`}>{whyLine(place)}</p>
        </div>
      </article>
    </li>
  );
}
