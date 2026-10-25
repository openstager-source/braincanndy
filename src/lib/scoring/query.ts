import { ALL_DISHES, AREAS, RESTAURANTS, areasNear } from "../sandbox/restaurants";
import type { Restaurant } from "../types";

export interface ParsedQuery {
  dish?: string;
  area?: string;
  areas?: string[];
  maxPrice?: number;
  /** Places named directly in the query ("brew theory"). */
  placeIds?: string[];
  /** Asked for something the sandbox doesn't have ("sushi on mars"): nothing matches. */
  unmatched?: true;
}

export const DEFAULT_QUERY = "best biryani near Gachibowli under ₹400";

/** Lowercase, accents removed ("café" → "cafe"), common phrasings folded into the sandbox's words. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/coffee ?(shops?|houses?|places?)/g, "cafe")
    .replace(/\s+/g, " ")
    .trim();
}

const plain = (s: string) => normalizeQuery(s).replace(/^the /, "").replace(/[^a-z0-9 ]/g, "").trim();
const NAMES = RESTAURANTS.map((r) => ({ id: r.id, name: plain(r.name) }));
const GENERIC = new Set(
  ("best top good great nice tasty cheap affordable budget popular famous food foods eat eating place places restaurant restaurants spot spots " +
    "joint joints hotel hotels where what which who should could can we i me my us our you to in at on of for near nearby around close by the a an " +
    "and or with some any find show recommend suggest try go hyderabad city today tonight now open lunch dinner breakfast brunch please is are " +
    "worth visit rated rating ratings review reviews").split(" "),
);

export function parseQuery(q: string): ParsedQuery {
  const t = normalizeQuery(q);
  const out: ParsedQuery = {};
  const named = NAMES.filter((n) => n.name.length > 3 && plain(t).includes(n.name)).map((n) => n.id);
  if (named.length > 0) out.placeIds = named;
  out.dish = [...ALL_DISHES].sort((a, b) => b.length - a.length).find((d) => t.includes(d));
  const area = Object.keys(AREAS).find((a) => t.includes(a.toLowerCase()));
  if (area) {
    out.area = area;
    out.areas = /\b(near|around|close to|nearby)\b/.test(t) ? areasNear(area) : [area];
  }
  const price = t.match(/(?:under|below|less than|within|<)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})/);
  if (price) out.maxPrice = Number(price[1]);
  // Nothing recognised: a generic ask ("best places to eat") matches everything, anything else nothing.
  if (!out.placeIds && !out.dish && !out.area && out.maxPrice === undefined && t.split(/[^a-z]+/).some((w) => w.length > 1 && !GENERIC.has(w))) out.unmatched = true;
  return out;
}

export function matches(r: Restaurant, p: ParsedQuery): boolean {
  if (p.unmatched) return false;
  if (p.placeIds) return p.placeIds.includes(r.id);
  if (p.dish && !r.dishes.includes(p.dish)) return false;
  if (p.areas && !p.areas.includes(r.area)) return false;
  if (p.maxPrice !== undefined && r.priceForOne > p.maxPrice) return false;
  return true;
}
