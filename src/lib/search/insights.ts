// Turns scored places into what the search page shows: a summary, a posting timeline,
// a short "why" line per result, and reviews for the real-or-fake check. Browser-safe.
import { DAY } from "../sandbox/generate";
import type { PlaceResult, QueryResult, Ranked } from "../scoring/engine";
import { FLAG_THRESHOLD, type ScoredReview, type SignalKind } from "../scoring/signals";

export type RankMode = "trust" | "raw";

export const REASON_LABEL: Record<SignalKind, string> = {
  burst: "posted in a sudden burst",
  account: "brand-new or one-review accounts",
  duplicate: "near-identical wording",
  deviation: "ratings far from the norm",
  injection: "instructions aimed at AI",
};

const flagged = (s: ScoredReview) => s.suspicion >= FLAG_THRESHOLD;

/** Signal kinds behind a place's flagged reviews, most common first. */
export function reasonCounts(place: PlaceResult): { kind: SignalKind; count: number }[] {
  const counts = new Map<SignalKind, number>();
  for (const s of place.scored) if (flagged(s)) for (const g of s.signals) counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}

/** Flagged reviews that are low ratings: the shape of a smear. */
const flaggedLow = (place: PlaceResult) => place.scored.filter((s) => flagged(s) && s.review.rating <= 2).length;

/**
 * What the flagged reviews add up to: bought praise ("boost"), a smear, or nothing worth a badge.
 * A few flags on a big, steady place are normal noise, not a campaign.
 */
export function campaignShape(place: PlaceResult): "boost" | "smear" | null {
  if (place.flagged < 4 || place.flagged / Math.max(1, place.reviewCount) < 0.12) return null;
  return flaggedLow(place) >= place.flagged / 2 ? "smear" : "boost";
}

/** One plain line under each result explaining its trust score. */
export function whyLine(place: PlaceResult): string {
  const n = place.reviewCount;
  if (place.flagged === 0) return "Steady reviews from established accounts. Nothing set aside.";
  const reasons = reasonCounts(place).slice(0, 2).map((r) => REASON_LABEL[r.kind]);
  if (flaggedLow(place) >= place.flagged / 2) return `${place.flagged} low ratings set aside: ${reasons.join(" and ")}. Looks like a smear.`;
  return `${place.flagged} of ${n} reviews set aside: ${reasons.join(" and ")}.`;
}

const rankOf = (list: Ranked[], id: string) => list.find((p) => p.restaurant.id === id)?.rank ?? 0;

/** Places Foolproof ranks higher than raw stars do (positive) or lower (negative). */
export const rankShift = (q: QueryResult, id: string) => rankOf(q.naive, id) - rankOf(q.foolproof, id);

/** The instant, no-AI answer at the top of the results. Built only from the scored data. */
export function summarize(q: QueryResult): string {
  const trust = q.foolproof;
  const raw = q.naive;
  const top = trust[0];
  if (!top || !raw[0]) return "";
  // A search that names one place is asking about that place, not for a recommendation.
  if (trust.length === 1) {
    return `${top.restaurant.name} rates ${top.trustRating.toFixed(1)}★ once suspicious reviews are weighed down, against ${top.naiveRating.toFixed(1)}★ in raw stars. ${whyLine(top)}`;
  }
  const parts = [
    `${top.restaurant.name} is the most trustworthy pick: ${top.trustRating.toFixed(1)}★ after weighing ${top.reviewCount} reviews${top.flagged ? `, ${top.flagged} of them with suspicious signals` : ", none with suspicious signals"}.`,
  ];
  const rawTop = raw[0];
  if (rawTop.restaurant.id !== top.restaurant.id) {
    const reasons = reasonCounts(rawTop).slice(0, 2).map((r) => REASON_LABEL[r.kind]).join(" and ");
    parts.push(
      `Raw stars would send you to ${rawTop.restaurant.name} (${rawTop.naiveRating.toFixed(1)}★), but ${rawTop.flagged} of its ${rawTop.reviewCount} reviews show suspicious signals${reasons ? `: ${reasons}` : ""}.`,
    );
  }
  const climber = trust.find((p) => p !== top && rankShift(q, p.restaurant.id) >= 2 && flaggedLow(p) >= 3);
  if (climber) parts.push(`${climber.restaurant.name} moves up: a cluster of suspicious low ratings was dragging it down.`);
  return parts.join(" ");
}

export interface Bin {
  start: number;
  clean: number;
  flagged: number;
}

/** Reviews per week, split into clean and flagged, for the posting timeline. */
export function timeline(place: PlaceResult, now: number, weeks = 26): Bin[] {
  const start = now - weeks * 7 * DAY;
  const bins: Bin[] = Array.from({ length: weeks }, (_, i) => ({ start: start + i * 7 * DAY, clean: 0, flagged: 0 }));
  for (const s of place.scored) {
    const i = Math.floor((s.review.createdAt - start) / (7 * DAY));
    const bin = bins[i];
    if (!bin) continue;
    if (flagged(s)) bin.flagged++;
    else bin.clean++;
  }
  return bins;
}

function ageText(days: number): string {
  if (days >= 730) return `${Math.floor(days / 365)} years`;
  if (days >= 365) return "1 year";
  if (days >= 60) return `${Math.floor(days / 30)} months`;
  const d = Math.max(1, Math.round(days));
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** What the detector saw about one review, in plain words. */
export function evidenceFor(s: ScoredReview): string[] {
  if (flagged(s)) return s.signals.map((g) => g.reason[0]!.toUpperCase() + g.reason.slice(1));
  const r = s.review;
  const n = r.reviewer.reviewCount;
  const facts = [`Account was ${ageText((r.createdAt - r.reviewer.createdAt) / DAY)} old when it posted`, `${n} review${n === 1 ? "" : "s"} on the platform`];
  if (!s.signals.some((g) => g.kind === "burst")) facts.push("Posted on a normal day, not in a burst");
  return facts;
}

/**
 * Reviews for "Is this review real or fake?": caught fakes and clearly genuine ones, alternating,
 * so the answer isn't always the same. Longer reviews first: they're the convincing ones.
 */
export function reviewsToCheck(place: PlaceResult, max = 6): ScoredReview[] {
  const byLength = (a: ScoredReview, b: ScoredReview) => b.review.text.length - a.review.text.length || a.review.id.localeCompare(b.review.id);
  const fakes = place.scored.filter((s) => s.review.label === "fake" && flagged(s)).sort(byLength);
  const real = place.scored.filter((s) => s.review.label === "genuine" && s.suspicion < 0.3).sort(byLength);
  const out: ScoredReview[] = [];
  for (let i = 0; out.length < max && (i < fakes.length || i < real.length); i++) {
    if (fakes[i]) out.push(fakes[i]!);
    if (real[i] && out.length < max) out.push(real[i]!);
  }
  return out;
}

export const formatDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
