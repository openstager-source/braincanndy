import { ALL_DISHES, AREAS, areasNear } from "../sandbox/restaurants";
import type { Restaurant } from "../types";

export interface ParsedQuery {
  dish?: string;
  area?: string;
  areas?: string[];
  maxPrice?: number;
}

export const DEFAULT_QUERY = "best biryani near Gachibowli under ₹400";

export function parseQuery(q: string): ParsedQuery {
  const t = q.toLowerCase();
  const out: ParsedQuery = {};
  out.dish = [...ALL_DISHES].sort((a, b) => b.length - a.length).find((d) => t.includes(d));
  const area = Object.keys(AREAS).find((a) => t.includes(a.toLowerCase()));
  if (area) {
    out.area = area;
    out.areas = /\b(near|around|close to)\b/.test(t) ? areasNear(area) : [area];
  }
  const price = t.match(/(?:under|below|less than|within|<)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})/);
  if (price) out.maxPrice = Number(price[1]);
  return out;
}

export function matches(r: Restaurant, p: ParsedQuery): boolean {
  if (p.dish && !r.dishes.includes(p.dish)) return false;
  if (p.areas && !p.areas.includes(r.area)) return false;
  if (p.maxPrice !== undefined && r.priceForOne > p.maxPrice) return false;
  return true;
}
