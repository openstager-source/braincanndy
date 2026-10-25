"use client";

import { useState } from "react";
import type { PlaceResult } from "@/lib/scoring/engine";
import { FLAG_THRESHOLD } from "@/lib/scoring/signals";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Inspector({ place }: { place: PlaceResult }) {
  const [all, setAll] = useState(false);
  const sorted = [...place.scored].sort((a, b) => b.suspicion - a.suspicion);
  const shown = all ? sorted : sorted.slice(0, 10);
  return (
    <section className="card stack" aria-labelledby="evidence-title">
      <div className="colhead" style={{ marginBottom: 0 }}>
        <div>
          <span className="eyebrow">Evidence</span>
          <h2 id="evidence-title">{place.restaurant.name}</h2>
          <p className="small muted">
            Raw <span className="mono">★ {place.naiveRating.toFixed(2)}</span> → trust-adjusted <span className="mono">★ {place.trustRating.toFixed(2)}</span> · {place.flagged} of {place.reviewCount} reviews show suspicious signals. Click any place above to open its file.
          </p>
        </div>
        <button onClick={() => setAll((x) => !x)}>{all ? "Show top 10" : `Show all ${sorted.length}`}</button>
      </div>
      <ul className="reviews">
        {shown.map((s) => {
          const flagged = s.suspicion >= FLAG_THRESHOLD;
          return (
            <li key={s.review.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="stars">{"★".repeat(s.review.rating)}<span className="muted">{"★".repeat(5 - s.review.rating)}</span></span>
                <span style={{ display: "flex", gap: 6 }}>
                  {flagged && <span className="chip chili">Suspicious {pct(s.suspicion)}</span>}
                  {s.review.label === "fake" && <span className="chip" title="Ground truth from the sandbox generator">injected fake</span>}
                </span>
              </div>
              <div className="bar"><span style={{ width: pct(s.suspicion), background: flagged ? "var(--chili)" : "var(--mint)" }} /></div>
              {/* Rendered as text, never as HTML: reviews are hostile input. */}
              <p className="text small">{s.review.text}</p>
              {s.signals.length > 0 && (
                <ul className="reasons">
                  {s.signals.map((g, i) => <li key={i}>{g.reason}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
