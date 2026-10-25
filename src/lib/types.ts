export type ReviewLabel = "genuine" | "fake";
export type AttackKind = "seeded" | "boost" | "smear" | "injection";

export interface Restaurant {
  id: string;
  name: string;
  area: string;
  dishes: string[];
  priceForOne: number;
}

export interface Reviewer {
  id: string;
  /** Total reviews this account has posted anywhere on the platform. */
  reviewCount: number;
  /** Account creation time (ms epoch). */
  createdAt: number;
}

export interface Review {
  id: string;
  restaurantId: string;
  rating: number;
  text: string;
  createdAt: number;
  reviewer: Reviewer;
  /** Ground truth. The scorer must never read this; it exists only for evaluation. */
  label: ReviewLabel;
  attack?: AttackKind;
}

export interface Sandbox {
  now: number;
  restaurants: Restaurant[];
  reviews: Review[];
  /** One place's reviews, generated on first use, so callers can skip places they never look at. */
  reviewsFor?: (restaurantId: string) => Review[];
}
