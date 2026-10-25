import { mulberry32, shuffle } from "../rng";
import { DAY, makeFakes } from "../sandbox/generate";
import { RESTAURANTS } from "../sandbox/restaurants";
import { evidenceFor } from "../search/insights";
import { FLAG_THRESHOLD, scorePlace, type ScoredReview } from "../scoring/signals";
import type { Restaurant, Review, Sandbox } from "../types";

export interface QuizItem {
  id: string;
  restaurant: Restaurant;
  review: Review;
  isFake: boolean;
  /** Foolproof's verdict, from behaviour signals rather than the words. */
  suspicion: number;
  detectorSaysFake: boolean;
  evidence: string[];
}

/**
 * Fakes written to sound human (as an LLM would) but posted the cheap way: fresh accounts,
 * all at once. Reading can't separate them from real reviews; posting patterns can.
 */
const CAMPAIGNS = [
  { restaurantId: "r22", kind: "boost", count: 12, daysAgo: 20, fakes: 2, real: 2 },
  { restaurantId: "r16", kind: "smear", count: 8, daysAgo: 45, fakes: 1, real: 1 },
] as const;

export const QUIZ_LENGTH = CAMPAIGNS.reduce((n, c) => n + c.fakes + c.real, 0);
export const QUIZ_FAKES = CAMPAIGNS.reduce((n, c) => n + c.fakes, 0);

const longestFirst = (a: ScoredReview, b: ScoredReview) => b.review.text.length - a.review.text.length || a.review.id.localeCompare(b.review.id);

export function buildQuiz(sb: Sandbox): QuizItem[] {
  const items: QuizItem[] = [];
  for (const c of CAMPAIGNS) {
    const spec = RESTAURANTS.find((r) => r.id === c.restaurantId)!;
    const restaurant = sb.restaurants.find((r) => r.id === c.restaurantId)!;
    const fakes = makeFakes(spec, {
      kind: c.kind, count: c.count, smart: false, textStyle: "genuine",
      endsAt: sb.now - c.daysAgo * DAY, idPrefix: `quiz-${c.kind}`, attack: c.kind,
    });
    const own = sb.reviewsFor?.(c.restaurantId) ?? sb.reviews.filter((r) => r.restaurantId === c.restaurantId);
    const scored = scorePlace([...own, ...fakes], sb.now);
    const sameMood = (r: Review) => (c.kind === "boost" ? r.rating >= 4 : r.rating <= 2);
    const toItem = (s: ScoredReview): QuizItem => ({
      id: s.review.id,
      restaurant,
      review: s.review,
      isFake: s.review.label === "fake",
      suspicion: s.suspicion,
      detectorSaysFake: s.suspicion >= FLAG_THRESHOLD,
      evidence: evidenceFor(s),
    });
    const caught = scored.filter((s) => s.review.label === "fake" && s.suspicion >= FLAG_THRESHOLD).sort(longestFirst).slice(0, c.fakes);
    const real = scored.filter((s) => s.review.label === "genuine" && s.suspicion < 0.3 && sameMood(s.review)).sort(longestFirst).slice(0, c.real);
    items.push(...caught.map(toItem), ...real.map(toItem));
  }
  return shuffle(mulberry32(7), items);
}
