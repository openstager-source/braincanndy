"use client";

import { useMemo, useRef, useState } from "react";
import { sandbox } from "@/lib/sandbox/instance";
import { runQuery } from "@/lib/scoring/engine";
import { rankShift, type RankMode } from "@/lib/search/insights";
import { useFlip } from "../useFlip";
import AiOverview from "./AiOverview";
import { AlertIcon } from "./icons";
import PlaceDrawer from "./PlaceDrawer";
import ResultCard from "./ResultCard";
import WebResults from "./WebResults";

const TRY = ["Best cafe in Gachibowli", "Biryani near Gachibowli under ₹400", "Cafes under ₹200", "Dosa near Madhapur"];
const PAGE = 10;

interface Props {
  query: string;
  mode: RankMode;
  onMode: (m: RankMode) => void;
  onSearch: (q: string) => void;
  live: boolean;
}

/** Everything under the search bar. Loaded on demand, so the home screen stays light. */
export default function ResultsView({ query, mode, onMode, onSearch, live }: Props) {
  const result = useMemo(() => runQuery(sandbox, query), [query]);
  const list = mode === "trust" ? result.foolproof : result.naive;
  // A search that names one place opens it straight away on wide screens.
  const [selected, setSelected] = useState<string | null>(() =>
    result.foolproof.length === 1 && matchMedia("(min-width: 981px)").matches ? result.foolproof[0]!.restaurant.id : null,
  );
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? list : list.slice(0, PAGE);
  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, shown.map((p) => p.restaurant.id).join("|"));

  if (list.length === 0) {
    return (
      <div className="results-grid single">
        <div className="results-main">
          <section className="empty glass" aria-labelledby="empty-title">
            <h2 id="empty-title">No places match “{query}”</h2>
            <p className="muted">The sandbox has 38 fictional places in Hyderabad. Try a dish (cafe, biryani, dosa), an area (Gachibowli, Kondapur) or a budget (under ₹400).</p>
            <div className="followups">{TRY.map((q) => <button key={q} type="button" onClick={() => onSearch(q)}>{q}</button>)}</div>
          </section>
          <WebResults query={query} parsed={result.parsed} live={live} />
        </div>
      </div>
    );
  }

  const trustTop = result.foolproof[0]!;
  const rawTop = result.naive[0]!;
  const flaggedTotal = list.reduce((n, p) => n + p.flagged, 0);
  const place = selected ? result.places.get(selected) ?? null : null;
  const rankOf = (id: string) => ({
    trust: result.foolproof.find((p) => p.restaurant.id === id)?.rank ?? 0,
    raw: result.naive.find((p) => p.restaurant.id === id)?.rank ?? 0,
  });
  const close = () => {
    const id = selected;
    setSelected(null);
    if (id) document.getElementById(`hit-${id}`)?.focus({ preventScroll: true });
  };

  return (
    <div className="results-grid">
      <div className="results-main">
        <AiOverview query={query} result={result} live={live} />

        <div className="results-meta">
          <span>
            <b>{list.length} {list.length === 1 ? "place" : "places"}</b> · {flaggedTotal} {flaggedTotal === 1 ? "review" : "reviews"} with suspicious signals{" "}
            {mode === "trust" ? "weighed down" : "counted in full"}
          </span>
          <div className="seg" role="group" aria-label="Rank by">
            <button type="button" aria-pressed={mode === "trust"} onClick={() => onMode("trust")}>Trust</button>
            <button type="button" aria-pressed={mode === "raw"} onClick={() => onMode("raw")}>Raw stars</button>
          </div>
        </div>

        {mode === "raw" && rawTop.restaurant.id !== trustTop.restaurant.id && (
          <div className="raw-note" role="note">
            <AlertIcon />
            <p>
              <b>Raw stars put {rawTop.restaurant.name} first.</b> {rawTop.flagged} of its {rawTop.reviewCount} reviews show suspicious signals. This is the pick a naive AI would make.
            </p>
            <button type="button" onClick={() => onMode("trust")}>Use trust ranking</button>
          </div>
        )}

        <ol className="result-list" ref={listRef} aria-label="Results">
          {shown.map((p, i) => (
            <ResultCard
              key={p.restaurant.id}
              place={p}
              index={i}
              mode={mode}
              shift={rankShift(result, p.restaurant.id)}
              selected={selected === p.restaurant.id}
              onSelect={(id) => setSelected((s) => (s === id ? null : id))}
            />
          ))}
        </ol>
        {shown.length < list.length && (
          <button type="button" className="more" onClick={() => setShowAll(true)}>
            Show all {list.length} places
          </button>
        )}

        <WebResults query={query} parsed={result.parsed} live={live} />
      </div>
      <PlaceDrawer place={place} ranks={place ? rankOf(place.restaurant.id) : null} live={live} now={sandbox.now} onClose={close} />
    </div>
  );
}
