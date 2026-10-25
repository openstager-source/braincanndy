import type { Review, Sandbox } from "../types";
import { SANDBOX_NOW, placeReviews, toRestaurant } from "./generate";
import { RESTAURANTS } from "./restaurants";

// One deterministic sandbox for the whole app, so the server and the browser agree. Places are
// generated on first use: a search touches a handful of the 38 places, not all of them.
const byPlace = new Map<string, Review[]>();

function reviewsFor(id: string): Review[] {
  let list = byPlace.get(id);
  if (!list) {
    const spec = RESTAURANTS.find((s) => s.id === id);
    byPlace.set(id, (list = spec ? placeReviews(spec) : []));
  }
  return list;
}

let all: Review[] | undefined;

export const sandbox: Sandbox = {
  now: SANDBOX_NOW,
  restaurants: RESTAURANTS.map(toRestaurant),
  get reviews() {
    return (all ??= RESTAURANTS.flatMap((s) => reviewsFor(s.id)));
  },
  reviewsFor,
};
