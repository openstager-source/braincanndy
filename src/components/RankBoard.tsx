"use client";

import { useRef } from "react";
import type { Ranked } from "@/lib/scoring/engine";
import { useFlip } from "./useFlip";

interface Props {
  tone: "naive" | "fool";
  title: string;
  subtitle: string;
  items: Ranked[];
  score: (p: Ranked) => number;
  baselineRanks: Map<string, number>;
  baselineTop?: string;
  selected?: string;
  onSelect: (id: string) => void;
}

export default function RankBoard(p: Props) {
  const list = useRef<HTMLOListElement>(null);
  useFlip(list, p.items.map((x) => x.restaurant.id).join("|"));
  const fooled = p.items[0] !== undefined && p.items[0].restaurant.id !== p.baselineTop;

  return (
    <section className={`card board ${p.tone}`} aria-labelledby={`${p.tone}-title`}>
      <div className="colhead">
        <div>
          <h2 id={`${p.tone}-title`} className="who">
            <i style={{ background: p.tone === "naive" ? "var(--chili)" : "var(--mint)" }} />
            {p.title}
          </h2>
          <p className="small muted">{p.subtitle}</p>
        </div>
        {/* Keyed so the stamp animates in again whenever the verdict changes. */}
        <span key={fooled ? "fooled" : "holds"} className={`stamp ${fooled ? "fooled" : "holds"}`}>{fooled ? "Fooled" : "Holds"}</span>
      </div>
      <ol className="rank" ref={list}>
        {p.items.slice(0, 6).map((x) => {
          const was = p.baselineRanks.get(x.restaurant.id);
          const moved = was === undefined ? 0 : was - x.rank;
          return (
            <li
              key={x.restaurant.id}
              data-key={x.restaurant.id}
              className={`${x.rank === 1 ? "top" : ""} ${p.selected === x.restaurant.id ? "sel" : ""}`}
              onClick={() => p.onSelect(x.restaurant.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  p.onSelect(x.restaurant.id);
                }
              }}
              tabIndex={0}
              aria-label={`#${x.rank} ${x.restaurant.name}. Open its reviews.`}
            >
              <span className="num">{x.rank}</span>
              <span style={{ minWidth: 0 }}>
                <span className="name">{x.restaurant.name}</span>
                {moved !== 0 && <span className={`move ${moved > 0 ? "up" : "down"}`}>{moved > 0 ? `↑${moved}` : `↓${-moved}`}</span>}
                <br />
                <span className="small muted">
                  {x.restaurant.area} · ₹{x.restaurant.priceForOne} · {x.reviewCount} reviews
                  {p.tone === "fool" && x.flagged > 0 && <> · <span style={{ color: "var(--chili)" }}>{x.flagged} suspicious</span></>}
                </span>
                {x.obeyedInjection && <><br /><span className="tag danger">Followed an instruction hidden in a review (simulated)</span></>}
              </span>
              <span className="stars">★ {p.score(x).toFixed(2)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
