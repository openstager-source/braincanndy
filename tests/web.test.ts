import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { passCookie } from "@/lib/server/guard";
import { handleHealth } from "@/lib/server/health";
import { handleWeb, normalizeWebQuery } from "@/lib/server/web";

const SITE = "https://foolproof.example";
const KEY = "test-web-key-123";
let ipCounter = 0;
let queryCounter = 0;

const get = (q: string | null, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/web${q === null ? "" : `?q=${encodeURIComponent(q)}`}`, { headers: { "Sec-Fetch-Site": "same-origin", ...headers } });
const call = (req: Request) => handleWeb(req, `10.3.0.${++ipCounter}`);
// Results are memoised per query inside the module, so each test searches for something new.
const fresh = () => `best cafe in gachibowli ${++queryCounter}`;

// Shaped like Serpstack's documented response, with some hostile and messy values mixed in.
const serp = () => ({
  request: { success: true },
  organic_results: [
    { position: 1, title: "Top cafes in Gachibowli", url: "https://www.example.com/cafes", domain: "www.example.com", displayed_url: "www.example.com › cafes", snippet: "A list of cafes." },
    { position: 2, title: "Click me", url: "javascript:alert(document.cookie)", snippet: "x" },
    { position: 3, title: "y".repeat(500), url: "https://blog.example.org/post", snippet: "line one\nline two\u0007" },
  ],
  local_results: [
    { position: 1, title: "Some Cafe", rating: 4.4, reviews: "1,234", type: "Cafe", address: "Gachibowli, Hyderabad" },
    { position: 2, title: "", rating: 4.1 },
    { position: 3, title: "Odd Place", rating: 9, reviews: -3 },
  ],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("WEB_SEARCH_API_KEY", KEY);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("web results (/api/web)", () => {
  it("returns only safe, trimmed fields and caches them on the CDN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(serp()));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(get(fresh()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Netlify-CDN-Cache-Control")).toContain("durable");
    expect(res.headers.get("Netlify-Vary")).toBe("query=q");

    const text = await res.text();
    expect(text).not.toContain(KEY);
    const body = JSON.parse(text);
    expect(body.links.map((l: { url: string }) => l.url)).toEqual(["https://www.example.com/cafes", "https://blog.example.org/post"]);
    expect(body.links[0].domain).toBe("example.com");
    expect(body.links[1].title).toHaveLength(140);
    expect(body.links[1].snippet).toBe("line one line two");
    expect(body.places).toEqual([
      { title: "Some Cafe", rating: 4.4, reviews: 1234, type: "Cafe", address: "Gachibowli, Hyderabad" },
      { title: "Odd Place" },
    ]);

    const upstream = new URL(fetchMock.mock.calls[0]![0] as URL);
    expect(upstream.protocol).toBe("https:");
    expect(upstream.host).toBe("api.serpstack.com");
    expect(upstream.searchParams.get("access_key")).toBe(KEY);
    expect(upstream.searchParams.get("gl")).toBe("in");
  });

  it("spends one search per query, however often it's asked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(serp()));
    vi.stubGlobal("fetch", fetchMock);
    const q = fresh();
    await call(get(q));
    await call(get(q.toUpperCase().replace(/ /g, "  ")));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps Serpstack's in-body errors and never caches them", async () => {
    const cases: [number, number, string][] = [[101, 502, "web_key_rejected"], [104, 503, "web_quota"], [105, 502, "web_plan"], [327, 503, "web_unavailable"]];
    for (const [code, status, error] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: false, error: { code, type: "x", info: `details for ${KEY}` } })));
      const res = await call(get(fresh()));
      expect(res.status).toBe(status);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error });
      expect(text).not.toContain(KEY);
    }
  });

  it("reports an unreachable or broken upstream as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await (await call(get(fresh()))).json()).toEqual({ error: "web_unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 502 })));
    expect(await (await call(get(fresh()))).json()).toEqual({ error: "web_unavailable" });
  });

  it("rejects bad input and other sites, without spending a search", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(get(null))).status).toBe(400);
    expect((await call(get("a"))).status).toBe(400);
    expect((await call(get("x".repeat(300)))).status).toBe(400);
    expect((await call(get(fresh(), { "Sec-Fetch-Site": "cross-site" }))).status).toBe(403);
    expect((await call(new Request(`${SITE}/api/web?q=cafes`, { method: "POST" }))).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 204 (nothing to show, not an error) when no key is set", async () => {
    vi.stubEnv("WEB_SEARCH_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(get(fresh()));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with Turnstile on, only visitors holding a pass can spend searches", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(serp())));
    expect(await (await call(get(fresh()))).json()).toEqual({ error: "bot_check" });
    const cookie = passCookie()!.split(";")[0]!;
    expect((await call(get(fresh(), { Cookie: cookie }))).status).toBe(200);
  });

  it("normalises queries so the cache sees one spelling", () => {
    expect(normalizeWebQuery("  Best   CAFE\tin Gachibowli\u0000 ")).toBe("best cafe in gachibowli");
  });

  it("shows up in the setup check without spending a search", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const report = await (await handleHealth(new Request(`${SITE}/api/health`), "10.3.9.9")).json();
    expect(report.webSearch).toBe("set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
