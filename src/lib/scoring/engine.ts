import { attackReviews, attackedPlaces, type AttackConfig } from "../sandbox/attacks";
import type { Restaurant, Review, Sandbox } from "../types";
import { matches, parseQuery, type ParsedQuery } from "./query";
import { FLAG_THRESHOLD, scorePlace, type ScoredReview } from "./signals";

/** Bayesian prior: every place starts as if it had PRIOR_WEIGHT reviews at PRIOR_MEAN. Fixed so attacks can't move it. */
export const PRIOR_MEAN = 3.8;
export const PRIOR_WEIGHT = 5;
/** Review weight = (1 − suspicion)^TRUST_GAMMA. Squaring pushes near-certain fakes close to zero. */
export const TRUST_GAMMA = 2;
export const reviewWeight = (suspicion: number) => Math.max(0, 1 - suspicion) ** TRUST_GAMMA;

export interface PlaceResult {
  restaurant: Restaurant;
  reviewCount: number;
  /** Stars at face value (same Bayesian prior, every review weight 1). */
  naiveRating: number;
  /** Each review weighted by (1 − suspicion)^2. */
  trustRating: number;
  flagged: number;
  hasInjection: boolean;
  scored: ScoredReview[];
}

export interface Ranked extends PlaceResult {
  rank: number;
  /** Naive pipeline only: moved to #1 because a review told the AI to. */
  obeyedInjection?: boolean;
}

export interface QueryResult {
  parsed: ParsedQuery;
  naive: Ranked[];
  foolproof: Ranked[];
  places: Map<string, PlaceResult>;
}

const bayes = (items: { r: number; w: number }[]) => {
  let sw = 0;
  let swr = 0;
  for (const { r, w } of items) {
    sw += w;
    swr += w * r;
  }
  return (PRIOR_WEIGHT * PRIOR_MEAN + swr) / (PRIOR_WEIGHT + sw);
};

export function scoreRestaurant(restaurant: Restaurant, reviews: Review[], now: number): PlaceResult {
  const scored = scorePlace(reviews, now);
  return {
    restaurant,
    reviewCount: reviews.length,
    naiveRating: bayes(reviews.map((r) => ({ r: r.rating, w: 1 }))),
    trustRating: bayes(scored.map((s) => ({ r: s.review.rating, w: reviewWeight(s.suspicion) }))),
    flagged: scored.filter((s) => s.suspicion >= FLAG_THRESHOLD).length,
    hasInjection: scored.some((s) => s.signals.some((g) => g.kind === "injection")),
    scored,
  };
}

/** Baseline scores are cached per sandbox; only places touched by an attack are rescored. */
const baselineCache = new WeakMap<Sandbox, Map<string, PlaceResult>>();
const byPlaceCache = new WeakMap<Sandbox, Map<string, Review[]>>();

function reviewsByPlace(sb: Sandbox) {
  let m = byPlaceCache.get(sb);
  if (!m) {
    m = new Map();
    for (const r of sb.reviews) {
      const list = m.get(r.restaurantId) ?? [];
      list.push(r);
      m.set(r.restaurantId, list);
    }
    byPlaceCache.set(sb, m);
  }
  return m;
}

export function scoreAll(sb: Sandbox, attack?: AttackConfig): Map<string, PlaceResult> {
  const byPlace = reviewsByPlace(sb);
  let base = baselineCache.get(sb);
  if (!base) {
    base = new Map(sb.restaurants.map((r) => [r.id, scoreRestaurant(r, byPlace.get(r.id) ?? [], sb.now)]));
    baselineCache.set(sb, base);
  }
  if (!attack) return base;
  const touched = attackedPlaces(attack);
  if (touched.size === 0) return base;
  const extra = attackReviews(sb, attack);
  const out = new Map(base);
  for (const id of touched) {
    const restaurant = sb.restaurants.find((r) => r.id === id)!;
    const all = [...(byPlace.get(id) ?? []), ...extra.filter((r) => r.restaurantId === id)];
    out.set(id, scoreRestaurant(restaurant, all, sb.now));
  }
  return out;
}

const withRanks = (xs: PlaceResult[]): Ranked[] => xs.map((x, i) => ({ ...x, rank: i + 1 }));

export function rank(places: Map<string, PlaceResult>, parsed: ParsedQuery) {
  const candidates = [...places.values()].filter((p) => matches(p.restaurant, parsed));

  const naiveSorted = [...candidates].sort((a, b) => b.naiveRating - a.naiveRating);
  // Simulated naive LLM: review text is pasted into the prompt and it follows embedded instructions.
  const obeyed = naiveSorted.find((p) => p.hasInjection);
  const naive = withRanks(obeyed ? [obeyed, ...naiveSorted.filter((p) => p !== obeyed)] : naiveSorted);
  if (obeyed) naive[0]!.obeyedInjection = true;

  const foolproof = withRanks([...candidates].sort((a, b) => b.trustRating - a.trustRating));
  return { naive, foolproof };
}

export function runQuery(sb: Sandbox, query: string, attack?: AttackConfig): QueryResult {
  const parsed = parseQuery(query);
  const places = scoreAll(sb, attack);
  return { parsed, places, ...rank(places, parsed) };
}

export interface FlipPoint {
  fakes: number;
  naiveRank: number;
  foolproofRank: number;
}

/** Rank of the attacked place as fake count goes 0..max, holding the rest of the attack fixed. */
export function flipCurve(sb: Sandbox, query: string, attack: AttackConfig, axis: "boost" | "smear", max: number): FlipPoint[] {
  const parsed = parseQuery(query);
  const target = axis === "boost" ? attack.boostTarget : attack.smearTarget;
  const out: FlipPoint[] = [];
  for (let k = 0; k <= max; k++) {
    const { naive, foolproof } = rank(scoreAll(sb, { ...attack, [axis]: k }), parsed);
    out.push({
      fakes: k,
      naiveRank: naive.findIndex((p) => p.restaurant.id === target) + 1,
      foolproofRank: foolproof.findIndex((p) => p.restaurant.id === target) + 1,
    });
  }
  return out;
}

export interface Metrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
}

export function detectionMetrics(places: Iterable<PlaceResult>, threshold = FLAG_THRESHOLD): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of places) {
    for (const s of p.scored) {
      const flagged = s.suspicion >= threshold;
      const fake = s.review.label === "fake";
      if (flagged && fake) tp++;
      else if (flagged) fp++;
      else if (fake) fn++;
      else tn++;
    }
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, tn, precision, recall, f1 };
}
