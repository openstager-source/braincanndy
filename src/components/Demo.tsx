"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { MAX_FAKES, NO_ATTACK, type AttackConfig } from "@/lib/sandbox/attacks";
import { generateSandbox } from "@/lib/sandbox/generate";
import { detectionMetrics, flipCurve, runQuery, type PlaceResult, type Ranked } from "@/lib/scoring/engine";
import { DEFAULT_QUERY } from "@/lib/scoring/query";
import { FLAG_THRESHOLD } from "@/lib/scoring/signals";
import FlipChart from "./FlipChart";
import LivePanel from "./LivePanel";

// Deterministic, so server prerender and client hydration produce the same data.
const sandbox = generateSandbox();
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** `live` is false for the static preview, which has no server to call the AI. */
export default function Demo({ live = true }: { live?: boolean }) {
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [attack, setAttack] = useState<AttackConfig>(NO_ATTACK);
  const [axis, setAxis] = useState<"boost" | "smear">("boost");
  const [selected, setSelected] = useState<string | null>(null);

  const baseline = useMemo(() => runQuery(sandbox, query), [query]);
  const candidates = useMemo(() => baseline.foolproof.map((p) => p.restaurant), [baseline]);

  // Keep attack targets inside the current result set.
  const effective = useMemo<AttackConfig>(() => {
    const ids = candidates.map((c) => c.id);
    if (ids.length === 0) return attack;
    return {
      ...attack,
      boostTarget: ids.includes(attack.boostTarget) ? attack.boostTarget : ids.at(-1)!,
      smearTarget: ids.includes(attack.smearTarget) ? attack.smearTarget : ids[0]!,
    };
  }, [attack, candidates]);

  const result = useMemo(() => runQuery(sandbox, query, effective), [query, effective]);
  const metrics = useMemo(() => detectionMetrics(result.places.values()), [result]);

  // The curve doesn't depend on the slider position, only on everything else. Compute it off the input path.
  const curveKey = useDeferredValue(JSON.stringify({ query, effective: { ...effective, [axis]: 0 }, axis }));
  const curve = useMemo(() => {
    const { query: q, effective: a, axis: ax } = JSON.parse(curveKey) as { query: string; effective: AttackConfig; axis: "boost" | "smear" };
    return flipCurve(sandbox, q, a, ax, MAX_FAKES);
  }, [curveKey]);

  const set = <K extends keyof AttackConfig>(k: K, v: AttackConfig[K]) => setAttack((a) => ({ ...effective, ...a, [k]: v }));
  const baselineTop = baseline.foolproof[0]?.restaurant.id;
  const inspected = result.places.get(selected ?? effective.boostTarget);

  return (
    <div className="stack">
      <form
        className="query"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim() || DEFAULT_QUERY);
          setSelected(null);
        }}
      >
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} aria-label="Ask where to eat" />
        <button className="primary" type="submit">Ask</button>
      </form>

      {result.foolproof.length === 0 ? (
        <p className="card muted">No sandbox restaurants match. Try a dish like biryani, haleem, dosa or mandi, and an area like Gachibowli or Charminar.</p>
      ) : (
        <>
          <div className="grid2">
            <Column title="Naive AI" subtitle="Takes stars and review text at face value" color="var(--naive)" items={result.naive} score={(p) => p.naiveRating} baselineTop={baselineTop} selected={inspected?.restaurant.id} onSelect={setSelected} />
            <Column title="Foolproof" subtitle="Each review counts by how trustworthy it looks" color="var(--fool)" items={result.foolproof} score={(p) => p.trustRating} baselineTop={baselineTop} selected={inspected?.restaurant.id} onSelect={setSelected} showFlags />
          </div>

          <section className="card stack">
            <div className="colhead">
              <h2 style={{ margin: 0 }}>Attack simulator</h2>
              <button onClick={() => setAttack({ ...NO_ATTACK, boostTarget: effective.boostTarget, smearTarget: effective.smearTarget })}>Reset</button>
            </div>
            <div className="controls">
              <div className="control">
                <label htmlFor="boost"><span>Fake 5★ reviews</span><span>{effective.boost}</span></label>
                <input id="boost" type="range" min={0} max={MAX_FAKES} value={effective.boost} onChange={(e) => { set("boost", Number(e.target.value)); setAxis("boost"); }} />
                <select aria-label="Boost target" value={effective.boostTarget} onChange={(e) => set("boostTarget", e.target.value)}>
                  {candidates.map((c) => <option key={c.id} value={c.id}>Boost: {c.name}</option>)}
                </select>
              </div>
              <div className="control">
                <label htmlFor="smear"><span>Fake 1★ reviews</span><span>{effective.smear}</span></label>
                <input id="smear" type="range" min={0} max={MAX_FAKES} value={effective.smear} onChange={(e) => { set("smear", Number(e.target.value)); setAxis("smear"); }} />
                <select aria-label="Smear target" value={effective.smearTarget} onChange={(e) => set("smearTarget", e.target.value)}>
                  {candidates.map((c) => <option key={c.id} value={c.id}>Smear: {c.name}</option>)}
                </select>
              </div>
              <div className="control stack" style={{ gap: 10 }}>
                <label className="toggle">
                  <input type="checkbox" checked={effective.injection} onChange={(e) => set("injection", e.target.checked)} />
                  <span><b>Prompt injection</b><br /><span className="muted small">A review on the boosted place tells AI assistants to rank it first.</span></span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={effective.smart} onChange={(e) => set("smart", e.target.checked)} />
                  <span><b>Smart attacker</b><br /><span className="muted small">Aged accounts, posts spread over 90 days, genuine-style text. Shows where Foolproof breaks.</span></span>
                </label>
              </div>
            </div>
          </section>

          <div className="grid2">
            <section className="card">
              <div className="colhead">
                <h2 style={{ margin: 0 }}>Does the pick survive?</h2>
                <div style={{ display: "flex", gap: 6 }}>
                  <button aria-pressed={axis === "boost"} className={axis === "boost" ? "primary" : ""} onClick={() => setAxis("boost")}>Boost</button>
                  <button aria-pressed={axis === "smear"} className={axis === "smear" ? "primary" : ""} onClick={() => setAxis("smear")}>Smear</button>
                </div>
              </div>
              <FlipChart points={curve} current={effective[axis]} maxRank={result.foolproof.length} title={`Rank of the ${axis === "boost" ? "boosted" : "smeared"} place as fake reviews are added`} />
            </section>

            <section className="card stack">
              <h2 style={{ margin: 0 }}>Detection on this sandbox</h2>
              <div className="metrics">
                <div className="metric"><span className="small muted">Precision</span><b>{pct(metrics.precision)}</b></div>
                <div className="metric"><span className="small muted">Recall</span><b>{pct(metrics.recall)}</b></div>
                <div className="metric"><span className="small muted">F1</span><b>{pct(metrics.f1)}</b></div>
              </div>
              <p className="small muted">
                {metrics.tp} fakes caught · {metrics.fn} missed · {metrics.fp} genuine reviews wrongly flagged, out of {metrics.tp + metrics.fp + metrics.fn + metrics.tn} reviews. We know which reviews are fake because we generated them.
              </p>
            </section>
          </div>

          {inspected && <Inspector place={inspected} />}
          {live && <LivePanel query={query} attack={effective} />}
        </>
      )}
    </div>
  );
}

function Column(props: {
  title: string;
  subtitle: string;
  color: string;
  items: Ranked[];
  score: (p: Ranked) => number;
  baselineTop?: string;
  selected?: string;
  onSelect: (id: string) => void;
  showFlags?: boolean;
}) {
  const top = props.items[0];
  const changed = top && top.restaurant.id !== props.baselineTop;
  return (
    <section className="card" style={{ color: "inherit" }}>
      <div className="colhead">
        <div>
          <h2 style={{ margin: 0 }}><span className="dot" style={{ background: props.color }} />{props.title}</h2>
          <p className="small muted">{props.subtitle}</p>
        </div>
        {changed ? <span className="tag danger">Top pick changed</span> : <span className="tag ok">Top pick holds</span>}
      </div>
      <ol className="rank">
        {props.items.slice(0, 6).map((p) => (
          <li
            key={p.restaurant.id}
            className={`${p.rank === 1 ? "top" : ""} ${props.selected === p.restaurant.id ? "sel" : ""}`}
            style={p.rank === 1 ? { color: props.color } : undefined}
            onClick={() => props.onSelect(p.restaurant.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && props.onSelect(p.restaurant.id)}
            tabIndex={0}
            aria-label={`Inspect reviews for ${p.restaurant.name}`}
          >
            <span className="num">#{p.rank}</span>
            <span style={{ color: "var(--text)" }}>
              <span className="name">{p.restaurant.name}</span>
              <br />
              <span className="small muted">
                {p.restaurant.area} · ₹{p.restaurant.priceForOne} · {p.reviewCount} reviews
                {props.showFlags && p.flagged > 0 && <> · <span style={{ color: "var(--warn)" }}>{p.flagged} suspicious</span></>}
              </span>
              {p.obeyedInjection && <><br /><span className="tag danger">Followed an instruction hidden in a review (simulated)</span></>}
            </span>
            <span className="stars" style={{ color: "var(--text)" }}>★ {props.score(p).toFixed(2)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Inspector({ place }: { place: PlaceResult }) {
  const [all, setAll] = useState(false);
  const sorted = [...place.scored].sort((a, b) => b.suspicion - a.suspicion);
  const shown = all ? sorted : sorted.slice(0, 10);
  return (
    <section className="card stack">
      <div className="colhead">
        <div>
          <h2 style={{ margin: 0 }}>Reviews: {place.restaurant.name}</h2>
          <p className="small muted">Raw ★ {place.naiveRating.toFixed(2)} → trust-adjusted ★ {place.trustRating.toFixed(2)} · {place.flagged} of {place.reviewCount} show suspicious signals. Click a place above to inspect it.</p>
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
                  {flagged && <span className="tag warn">Suspicious {pct(s.suspicion)}</span>}
                  {s.review.label === "fake" && <span className="tag" title="Ground truth from the sandbox generator">injected fake</span>}
                </span>
              </div>
              <div className="bar"><span style={{ width: pct(s.suspicion), background: flagged ? "var(--warn)" : "var(--accent)" }} /></div>
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
