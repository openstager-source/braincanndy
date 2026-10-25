// Live web results (Google, via Serpstack) for the "From the web" section of the search page.
// The key never leaves the server. Responses are trimmed to the fields the page shows and cached on
// Netlify's CDN per query, because Serpstack's free plan allows only 100 searches a month.
import { hasValidPass, rateLimit, turnstileEnabled } from "./guard";

const ENDPOINT = "https://api.serpstack.com/search";
const TIMEOUT_MS = 10_000;
const MAX_LINKS = 6;
const MAX_PLACES = 4;

export type WebError = "bad_request" | "forbidden" | "rate_limited" | "bot_check" | "web_key_rejected" | "web_quota" | "web_plan" | "web_unavailable";

export interface WebLink {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface WebPlace {
  title: string;
  rating?: number;
  reviews?: number;
  type?: string;
  address?: string;
}

export interface WebResponse {
  links: WebLink[];
  places: WebPlace[];
}

export function readWebKey(): string | undefined {
  const key = process.env.WEB_SEARCH_API_KEY?.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  return key || undefined;
}

/** Query as the cache sees it: one spelling per search, so repeats hit the cache. */
export const normalizeWebQuery = (q: string) => q.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Only plain http(s) links reach the page, never javascript: or data: URLs. */
function safeUrl(v: unknown): URL | null {
  if (typeof v !== "string" || v.length > 2048) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function toLink(r: Record<string, unknown>): WebLink | null {
  const url = safeUrl(r.url);
  const title = text(r.title, 140);
  if (!url || !title) return null;
  return { title, url: url.toString(), domain: url.hostname.replace(/^www\./, ""), snippet: text(r.snippet, 320) };
}

/** A number, or a number written as text ("1,234"). */
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function toPlace(r: Record<string, unknown>): WebPlace | null {
  const title = text(r.title, 100);
  if (!title) return null;
  const rating = num(r.rating);
  const reviews = num(r.reviews);
  return {
    title,
    rating: rating !== undefined && rating >= 0 && rating <= 5 ? rating : undefined,
    reviews: reviews !== undefined && Number.isInteger(reviews) && reviews >= 0 ? reviews : undefined,
    type: text(r.type, 60) || undefined,
    address: text(r.address, 140) || undefined,
  };
}

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : []);

/** Serpstack reports errors in the body (often with HTTP 200): { success: false, error: { code, type } }. */
function serpstackError(code: unknown): { status: number; error: WebError } {
  if (code === 101 || code === 102) return { status: 502, error: "web_key_rejected" };
  if (code === 104) return { status: 503, error: "web_quota" };
  if (code === 105) return { status: 502, error: "web_plan" };
  return { status: 503, error: "web_unavailable" };
}

// Second cache layer for a warm instance (and for local development, which has no CDN).
const memo = new Map<string, { at: number; body: WebResponse }>();
const MEMO_MS = 6 * 3600_000;

const json = (status: number, error: WebError, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

const CACHED = {
  // Browsers keep it 10 minutes; Netlify's CDN shares it across edge nodes for a week.
  "Cache-Control": "public, max-age=600",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=604800, stale-while-revalidate=86400",
  // Only q varies the cache, so extra junk parameters can't force fresh (paid) searches.
  "Netlify-Vary": "query=q",
};

export async function handleWeb(req: Request, ip: string): Promise<Response> {
  if (req.method !== "GET") return json(405, "bad_request", { Allow: "GET" });
  // Browsers say where a request came from; other sites' pages may not use this endpoint.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return json(403, "forbidden");

  const raw = new URL(req.url).searchParams.get("q") ?? "";
  const q = normalizeWebQuery(raw);
  if (q.length < 2 || raw.length > 200 || q.length > 120) return json(400, "bad_request");

  const hit = memo.get(q);
  if (hit && Date.now() - hit.at < MEMO_MS) return Response.json(hit.body, { headers: CACHED });

  const key = readWebKey();
  // Web results are optional: without a key there's simply nothing to show (204, not an error).
  if (!key) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const limited = rateLimit(ip);
  if (!limited.ok) return json(429, "rate_limited", { "Retry-After": String(limited.retryAfter) });
  // With Turnstile on, only visitors who passed it (the AI request earns the pass) can spend searches.
  if (turnstileEnabled() && !hasValidPass(req)) return json(403, "bot_check");

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ access_key: key, query: q, gl: "in", hl: "en", google_domain: "google.co.in", num: "10", safe: "1", output: "json" }).toString();

  let data: Record<string, unknown> | null;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return json(503, "web_unavailable", { "Retry-After": "30" });
  } catch {
    return json(503, "web_unavailable", { "Retry-After": "30" });
  }

  if (data.success === false || data.error) {
    const err = (data.error ?? {}) as { code?: unknown; type?: unknown };
    // Status words only: Serpstack's messages can echo request details.
    console.warn("serpstack error", err.code, err.type);
    const { status, error } = serpstackError(err.code);
    return json(status, error);
  }

  const body: WebResponse = {
    links: list(data.organic_results).map(toLink).filter((x): x is WebLink => x !== null).slice(0, MAX_LINKS),
    places: list(data.local_results).map(toPlace).filter((x): x is WebPlace => x !== null).slice(0, MAX_PLACES),
  };
  if (memo.size > 500) memo.clear();
  memo.set(q, { at: Date.now(), body });
  return Response.json(body, { headers: CACHED });
}
