import { hashString, mulberry32, normal, randInt, type Rng } from "../rng";
import type { Restaurant, Review, Reviewer, Sandbox } from "../types";
import { RESTAURANTS, type RestaurantSpec } from "./restaurants";
import { fakeText, genuineText, injectionText } from "./text";

export const DAY = 86_400_000;
/** Fixed clock so every run of the sandbox is identical. */
export const SANDBOX_NOW = Date.UTC(2026, 9, 20, 12);
export const SANDBOX_SEED = 42;

const clampRating = (x: number) => Math.min(5, Math.max(1, Math.round(x)));

function genuineReviewer(r: Rng, id: string, postedAt: number): Reviewer {
  // ~25% of real accounts only ever post one review, and some of those are brand new.
  const single = r() < 0.25;
  const reviewCount = single ? 1 : 2 + Math.floor(-Math.log(Math.max(r(), 1e-9)) * 14);
  const freshSignup = single && r() < 0.3;
  const ageDays = freshSignup ? r() * 5 : 30 + r() * 1500;
  return { id, reviewCount, createdAt: postedAt - ageDays * DAY };
}

export function toRestaurant(s: RestaurantSpec): Restaurant {
  return { id: s.id, name: s.name, area: s.area, dishes: s.dishes, priceForOne: s.priceForOne };
}

export interface FakeOptions {
  kind: "boost" | "smear";
  count: number;
  /** Smart attackers use aged accounts, spread posts out and copy genuine writing style. */
  smart: boolean;
  /** Campaign ends at this time. */
  endsAt: number;
  idPrefix: string;
  attack: Review["attack"];
}

export function makeFakes(spec: RestaurantSpec, o: FakeOptions): Review[] {
  const r = mulberry32(hashString(`${spec.id}:${o.idPrefix}:${o.kind}:${o.smart}`));
  const out: Review[] = [];
  for (let i = 0; i < o.count; i++) {
    const spreadDays = o.smart ? 90 : 2;
    const createdAt = o.endsAt - r() * spreadDays * DAY;
    const rating = o.kind === "boost" ? (o.smart && r() < 0.3 ? 4 : 5) : o.smart && r() < 0.3 ? 2 : 1;
    const reviewer: Reviewer = o.smart
      ? { id: `${o.idPrefix}-u${i}`, reviewCount: randInt(r, 5, 40), createdAt: createdAt - (200 + r() * 700) * DAY }
      : { id: `${o.idPrefix}-u${i}`, reviewCount: r() < 0.8 ? 1 : randInt(r, 2, 3), createdAt: createdAt - r() * 2 * DAY };
    out.push({
      id: `${o.idPrefix}-${i}`,
      restaurantId: spec.id,
      rating,
      text: o.smart ? genuineText(r, spec, rating) : fakeText(r, spec, o.kind),
      createdAt,
      reviewer,
      label: "fake",
      attack: o.attack,
    });
  }
  return out;
}

export function makeInjection(spec: RestaurantSpec, now: number): Review {
  const createdAt = now - 0.5 * DAY;
  return {
    id: `${spec.id}-inj`,
    restaurantId: spec.id,
    rating: 5,
    text: injectionText(spec),
    createdAt,
    reviewer: { id: `${spec.id}-inj-u`, reviewCount: 1, createdAt: createdAt - 0.2 * DAY },
    label: "fake",
    attack: "injection",
  };
}

export function generateSandbox(seed = SANDBOX_SEED): Sandbox {
  const now = SANDBOX_NOW;
  const reviews: Review[] = [];
  for (const spec of RESTAURANTS) {
    const r = mulberry32(seed ^ hashString(spec.id));
    const openedAt = now - spec.ageDays * DAY;
    for (let i = 0; i < spec.reviews; i++) {
      const createdAt = openedAt + r() * (now - openedAt - DAY);
      const rating = clampRating(normal(r, spec.quality, 0.9));
      reviews.push({
        id: `${spec.id}-g${i}`,
        restaurantId: spec.id,
        rating,
        text: genuineText(r, spec, rating),
        createdAt,
        reviewer: genuineReviewer(r, `${spec.id}-gu${i}`, createdAt),
        label: "genuine",
      });
    }
    if (spec.campaign) {
      reviews.push(
        ...makeFakes(spec, {
          kind: spec.campaign.kind,
          count: spec.campaign.count,
          smart: false,
          endsAt: now - spec.campaign.daysAgo * DAY,
          idPrefix: `${spec.id}-seed`,
          attack: "seeded",
        }),
      );
    }
  }
  return { now, restaurants: RESTAURANTS.map(toRestaurant), reviews };
}
