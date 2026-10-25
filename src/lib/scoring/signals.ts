import { DAY } from "../sandbox/generate";
import { clamp01 } from "../rng";
import type { Review } from "../types";
import { cosine, detectInjection, textVector, type SparseVec } from "./text";

export type SignalKind = "burst" | "deviation" | "account" | "duplicate" | "injection";

export interface Signal {
  kind: SignalKind;
  /** 0..1 */
  strength: number;
  reason: string;
}

export interface ScoredReview {
  review: Review;
  /** 0 = looks genuine, 1 = certainly suspicious. */
  suspicion: number;
  signals: Signal[];
}

/** How much each signal can contribute on its own (noisy-OR). Tuned on the sandbox, see scripts/eval.ts. */
export const SIGNAL_WEIGHTS: Record<SignalKind, number> = {
  burst: 0.6,
  deviation: 0.4,
  account: 0.4,
  duplicate: 0.65,
  injection: 1,
};

export const FLAG_THRESHOLD = 0.5;
const DUP_SIM = 0.6;

const vecCache = new WeakMap<Review, SparseVec>();
const vec = (r: Review) => {
  let v = vecCache.get(r);
  if (!v) vecCache.set(r, (v = textVector(r.text)));
  return v;
};

const combine = (signals: Signal[]) => 1 - signals.reduce((p, s) => p * (1 - SIGNAL_WEIGHTS[s.kind] * s.strength), 1);

function weightedMedian(items: { x: number; w: number }[]): number {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const total = sorted.reduce((s, i) => s + i.w, 0);
  let acc = 0;
  for (const i of sorted) {
    acc += i.w;
    if (acc >= total / 2) return i.x;
  }
  return sorted.at(-1)?.x ?? 3;
}

/**
 * Score every review of ONE place. Signals are mostly behavioural (timing, account, rating),
 * because text alone can't reliably separate LLM-written fakes from real reviews.
 */
export function scorePlace(reviews: Review[], now: number): ScoredReview[] {
  const rs = [...reviews].sort((a, b) => a.createdAt - b.createdAt);
  const n = rs.length;
  if (n === 0) return [];

  const spanDays = Math.max(30, (now - rs[0]!.createdAt) / DAY);
  const expectedIn48h = (n / spanDays) * 2;
  const vecs = rs.map(vec);

  // Window counts (±24h) with two pointers.
  const window: number[] = new Array(n).fill(0);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const t = rs[i]!.createdAt;
    while (rs[lo]!.createdAt < t - DAY) lo++;
    while (hi < n && rs[hi]!.createdAt <= t + DAY) hi++;
    window[i] = hi - lo - 1;
  }

  // Pairwise text similarity, each pair computed once.
  const maxSim = new Float64Array(n);
  const similarCount = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = cosine(vecs[i]!, vecs[j]!);
      if (s > maxSim[i]!) maxSim[i] = s;
      if (s > maxSim[j]!) maxSim[j] = s;
      if (s >= DUP_SIM) {
        similarCount[i]!++;
        similarCount[j]!++;
      }
    }
  }

  const pass1: Signal[][] = rs.map((r, i) => {
    const sig: Signal[] = [];

    const inj = detectInjection(r.text);
    if (inj) sig.push({ kind: "injection", strength: 1, reason: `Prompt injection: ${inj}` });

    const excess = window[i]! - expectedIn48h;
    const burst = clamp01((excess - 2) / 6);
    if (burst > 0) sig.push({ kind: "burst", strength: burst, reason: `${window[i]! + 1} reviews within 48h (normal: ~${Math.max(1, Math.round(expectedIn48h))})` });

    const ageDays = (r.createdAt - r.reviewer.createdAt) / DAY;
    const single = r.reviewer.reviewCount <= 1;
    const fresh = ageDays < 7;
    if (single || fresh) {
      const days = Math.round(ageDays);
      const age = ageDays < 1 ? "<1 day" : `${days} day${days === 1 ? "" : "s"}`;
      const parts = [single && "account's only review", fresh && `account created ${age} before posting`].filter(Boolean);
      sig.push({ kind: "account", strength: single && fresh ? 1 : 0.5, reason: parts.join(", ") });
    }

    const best = maxSim[i]!;
    const similar = similarCount[i]!;
    // Needs a cluster, not one coincidental match: short genuine reviews collide by chance.
    const dup = similar >= 2 ? clamp01((best - 0.55) / 0.3) * Math.min(1, similar / 3) : 0;
    if (dup > 0) sig.push({ kind: "duplicate", strength: dup, reason: `text ${Math.round(best * 100)}% similar to ${similar} other review${similar === 1 ? "" : "s"}` });

    return sig;
  });

  // "Typical" rating = median weighted by how trustworthy each review looks so far,
  // so a flood of fakes can't drag the baseline toward itself.
  const typical = weightedMedian(rs.map((r, i) => ({ x: r.rating, w: 1 - combine(pass1[i]!) + 1e-6 })));

  return rs.map((r, i) => {
    const sig = pass1[i]!;
    const d = Math.abs(r.rating - typical);
    const dev = clamp01((d - 1.5) / 1.5);
    if (dev > 0) sig.push({ kind: "deviation", strength: dev, reason: `${r.rating}★ vs typical ${typical}★ for this place` });
    return { review: r, suspicion: combine(sig), signals: sig };
  });
}
