"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BUDGET, COST, MISSIONS, attackCost, costPerFake, type GameState } from "@/lib/game/missions";
import { MAX_FAKES, NO_ATTACK, type AttackConfig } from "@/lib/sandbox/attacks";
import { sandbox } from "@/lib/sandbox/instance";
import { runWhenIdle } from "@/lib/idle";
import { detectionMetrics, flipCurvePoints, runQuery, scoreAll, scorePlaces, type FlipPoint } from "@/lib/scoring/engine";
import { DEFAULT_QUERY } from "@/lib/scoring/query";
import FlipChart from "./FlipChart";
import Inspector from "./Inspector";
import LivePanel from "./LivePanel";
import Missions from "./Missions";
import RankBoard from "./RankBoard";

const pct = (x: number) => `${Math.round(x * 100)}%`;

interface Props {
  live: boolean;
  done: string[];
  /** Saved progress has loaded, so missions can be awarded. */
  ready: boolean;
  onMissions: (ids: string[]) => void;
}

export default function Lab({ live, done, ready, onMissions }: Props) {
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [attack, setAttack] = useState<AttackConfig>(NO_ATTACK);
  const [axis, setAxis] = useState<"boost" | "smear">("boost");
  const [selected, setSelected] = useState<string | null>(null);
  const [liveRan, setLiveRan] = useState(false);

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

  // Sandbox-wide numbers need every restaurant scored once. Do that in small idle-time slices after load,
  // so a tap is never stuck behind it; after that, updates are cheap because baselines are cached.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const ids = sandbox.restaurants.map((r) => r.id);
    let next = 0;
    return runWhenIdle(
      () => {
        scorePlaces(sandbox, undefined, [ids[next++]!]);
        return next >= ids.length;
      },
      () => setWarm(true),
    );
  }, []);
  const metricsKey = useDeferredValue(JSON.stringify(effective), "");
  const metrics = useMemo(
    () => (warm && metricsKey ? detectionMetrics(scoreAll(sandbox, JSON.parse(metricsKey) as AttackConfig).values()) : null),
    [warm, metricsKey],
  );
  const ranks = useMemo(
    () => ({
      naive: new Map(baseline.naive.map((p) => [p.restaurant.id, p.rank])),
      fool: new Map(baseline.foolproof.map((p) => [p.restaurant.id, p.rank])),
    }),
    [baseline],
  );

  // The curve doesn't depend on the slider position, only on everything else. It's recomputed in idle
  // time after the tap has painted; until then the chart keeps showing the previous curve.
  const curveKey = JSON.stringify({ query, effective: { ...effective, [axis]: 0 }, axis });
  const [curveState, setCurveState] = useState<{ key: string; points: FlipPoint[] } | null>(null);
  useEffect(() => {
    if (curveState?.key === curveKey) return;
    const { query: q, effective: a, axis: ax } = JSON.parse(curveKey) as { query: string; effective: AttackConfig; axis: "boost" | "smear" };
    const points = flipCurvePoints(sandbox, q, a, ax, MAX_FAKES);
    const done: FlipPoint[] = [];
    return runWhenIdle(
      () => {
        const next = points.next();
        if (!next.done) done.push(next.value);
        return next.done === true;
      },
      () => setCurveState({ key: curveKey, points: done }),
    );
  }, [curveKey, curveState?.key]);
  const curve = curveState?.points ?? null;

  const cost = attackCost(effective);
  const over = cost > BUDGET;

  // Check missions after every change; the parent awards each one once.
  useEffect(() => {
    if (!ready) return;
    const state: GameState = { attack: effective, result, baseline, inspected: selected, liveRan };
    const won = MISSIONS.filter((m) => (!m.requiresLive || live) && !done.includes(m.id) && m.check(state)).map((m) => m.id);
    if (won.length > 0) onMissions(won);
  }, [ready, live, done, effective, result, baseline, selected, liveRan, onMissions]);

  // Pinned scoreboard: shown once the verdict boards scroll out of view, so the effect of each slider stays visible.
  const boards = useRef<HTMLDivElement>(null);
  const [boardsInView, setBoardsInView] = useState(true);
  const hasResults = result.foolproof.length > 0;
  useEffect(() => {
    const el = boards.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setBoardsInView(entry?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, [hasResults]);

  const set = <K extends keyof AttackConfig>(k: K, v: AttackConfig[K]) => setAttack({ ...effective, [k]: v });
  const inspected = result.places.get(selected ?? effective.boostTarget);
  const naiveFooled = result.naive[0]?.restaurant.id !== baseline.naive[0]?.restaurant.id;
  const foolFooled = result.foolproof[0]?.restaurant.id !== baseline.foolproof[0]?.restaurant.id;

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
        <input id="query" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} aria-label="Ask where to eat" />
        <button className="primary" type="submit">Ask</button>
      </form>

      {result.foolproof.length === 0 ? (
        <p className="card muted">No sandbox restaurants match. Try a dish like biryani, haleem, dosa or mandi, and an area like Gachibowli or Charminar.</p>
      ) : (
        <>
          <div className={`strip ${boardsInView ? "" : "show"}`} aria-hidden={boardsInView}>
            <span className="side">
              <i style={{ background: "var(--chili)" }} />
              <span className="muted">Naive</span> <b>{result.naive[0]?.restaurant.name}</b>
              <span className={`chip ${naiveFooled ? "chili" : "mint"}`}>{naiveFooled ? "Fooled" : "Holds"}</span>
            </span>
            <span className="side">
              <i style={{ background: "var(--mint)" }} />
              <span className="muted">Foolproof</span> <b>{result.foolproof[0]?.restaurant.name}</b>
              <span className={`chip ${foolFooled ? "chili" : "mint"}`}>{foolFooled ? "Fooled" : "Holds"}</span>
            </span>
            <span className={`chip ${over ? "chili" : "saffron"}`}>{over ? `${cost - BUDGET} over budget` : `${BUDGET - cost} credits left`}</span>
          </div>

          <div className="grid2" ref={boards}>
            <RankBoard
              tone="naive" title="Naive AI" subtitle="Takes stars and review text at face value"
              items={result.naive} score={(p) => p.naiveRating} baselineRanks={ranks.naive}
              baselineTop={baseline.naive[0]?.restaurant.id} selected={selected ?? undefined} onSelect={setSelected}
            />
            <RankBoard
              tone="fool" title="Foolproof" subtitle="Each review counts by how trustworthy it looks"
              items={result.foolproof} score={(p) => p.trustRating} baselineRanks={ranks.fool}
              baselineTop={baseline.foolproof[0]?.restaurant.id} selected={selected ?? undefined} onSelect={setSelected}
            />
          </div>

          <div className="deckgrid">
            <section className="card" aria-labelledby="deck-title">
              <div className="colhead">
                <div>
                  <span className="eyebrow">You are the attacker</span>
                  <h2 id="deck-title">Attacker&rsquo;s deck</h2>
                  <p className="small muted">Spend credits on fake reviews and try to change the #1 pick.</p>
                </div>
                <button onClick={() => setAttack({ ...NO_ATTACK, boostTarget: effective.boostTarget, smearTarget: effective.smearTarget })}>Clear attack</button>
              </div>

              <div className={`meter ${over ? "over" : ""}`}>
                <div className="row">
                  <span className="big">
                    {Math.max(0, BUDGET - cost)}
                    <span className="small muted" style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}> / {BUDGET} credits left</span>
                  </span>
                  {over ? <span className="chip chili">Over budget by {cost - BUDGET}: missions paused</span> : <span className="chip">{cost} spent</span>}
                </div>
                <div className="track" role="meter" aria-label="Credits spent" aria-valuemin={0} aria-valuemax={BUDGET} aria-valuenow={Math.min(cost, BUDGET)}>
                  <span style={{ width: `${Math.min(100, (cost / BUDGET) * 100)}%` }} />
                </div>
              </div>

              <div className="tools">
                <Tool on={effective.boost > 0} title="Fake 5★ reviews" cost={`${costPerFake(effective)} each`} count={effective.boost}>
                  <input id="boost" type="range" min={0} max={MAX_FAKES} value={effective.boost} aria-label="Number of fake 5-star reviews"
                    onChange={(e) => { set("boost", Number(e.target.value)); setAxis("boost"); }} />
                  <select aria-label="Restaurant to boost" value={effective.boostTarget} onChange={(e) => set("boostTarget", e.target.value)}>
                    {candidates.map((c) => <option key={c.id} value={c.id}>Boost {c.name}</option>)}
                  </select>
                </Tool>
                <Tool on={effective.smear > 0} title="Fake 1★ reviews" cost={`${costPerFake(effective)} each`} count={effective.smear}>
                  <input id="smear" type="range" min={0} max={MAX_FAKES} value={effective.smear} aria-label="Number of fake 1-star reviews"
                    onChange={(e) => { set("smear", Number(e.target.value)); setAxis("smear"); }} />
                  <select aria-label="Restaurant to smear" value={effective.smearTarget} onChange={(e) => set("smearTarget", e.target.value)}>
                    {candidates.map((c) => <option key={c.id} value={c.id}>Smear {c.name}</option>)}
                  </select>
                </Tool>
                <Tool on={effective.injection} title="Hidden instruction" cost={`${COST.injection} credits`}>
                  <p className="small muted">Plants a review on the boosted place that tells AI assistants to rank it first.</p>
                  <button className={`switch ${effective.injection ? "go" : ""}`} aria-pressed={effective.injection} onClick={() => set("injection", !effective.injection)}>
                    {effective.injection ? "Planted" : "Plant it"}
                  </button>
                </Tool>
                <Tool on={effective.smart} title="Smart accounts" cost={`fakes ×${COST.smartMultiplier}`}>
                  <p className="small muted">Aged accounts that post slowly in a normal voice. Harder to catch, pricier to run.</p>
                  <button className={`switch ${effective.smart ? "go" : ""}`} aria-pressed={effective.smart} onClick={() => set("smart", !effective.smart)}>
                    {effective.smart ? "In use" : "Use them"}
                  </button>
                </Tool>
              </div>
            </section>
            <Missions done={done} live={live} />
          </div>

          <div className="grid2 offscreen">
            <section className="card">
              <div className="colhead">
                <h2>Does the pick survive?</h2>
                <div style={{ display: "flex", gap: 6 }}>
                  <button aria-pressed={axis === "boost"} className={axis === "boost" ? "primary" : ""} onClick={() => setAxis("boost")}>Boost</button>
                  <button aria-pressed={axis === "smear"} className={axis === "smear" ? "primary" : ""} onClick={() => setAxis("smear")}>Smear</button>
                </div>
              </div>
              {curve ? (
                <FlipChart points={curve} current={effective[axis]} maxRank={result.foolproof.length}
                  title={`Rank of the ${axis === "boost" ? "boosted" : "smeared"} place as fake reviews are added`} />
              ) : (
                <div aria-hidden="true"><div className="chart-wait" /><div style={{ height: 26 }} /></div>
              )}
            </section>

            <section className="card stack">
              <h2>Detection on this sandbox</h2>
              <div className="metrics">
                <div className="metric"><span className="small muted">Precision</span><b>{metrics ? pct(metrics.precision) : "…"}</b></div>
                <div className="metric"><span className="small muted">Recall</span><b>{metrics ? pct(metrics.recall) : "…"}</b></div>
                <div className="metric"><span className="small muted">F1</span><b>{metrics ? pct(metrics.f1) : "…"}</b></div>
              </div>
              <p className="small muted">
                {metrics
                  ? `${metrics.tp} fakes caught · ${metrics.fn} missed · ${metrics.fp} genuine reviews wrongly flagged, out of ${metrics.tp + metrics.fp + metrics.fn + metrics.tn} reviews.`
                  : "Scoring every review in the sandbox…"}{" "}
                We know which reviews are fake because we generated them.
              </p>
            </section>
          </div>

          <div className="offscreen">{inspected && <Inspector place={inspected} />}</div>
          {live && <div className="offscreen"><LivePanel query={query} attack={effective} onDone={() => setLiveRan(true)} /></div>}
        </>
      )}
    </div>
  );
}

function Tool({ on, title, cost, count, children }: { on: boolean; title: string; cost: string; count?: number; children: ReactNode }) {
  return (
    <div className={`tool ${on ? "on" : ""}`}>
      <header>
        <h3>{title}</h3>
        <span className="chip saffron">{cost}</span>
      </header>
      {count !== undefined && <span className="count">{count}</span>}
      {children}
    </div>
  );
}
