import { describe, expect, it } from "vitest";
import { sandbox } from "@/lib/sandbox/instance";
import { RESTAURANTS } from "@/lib/sandbox/restaurants";
import { runQuery, scoreAll, scorePlaces } from "@/lib/scoring/engine";
import { normalizeQuery, parseQuery } from "@/lib/scoring/query";
import { FLAG_THRESHOLD } from "@/lib/scoring/signals";
import { DAY } from "@/lib/sandbox/generate";
import { campaignShape, evidenceFor, reviewsToCheck, summarize, timeline, whyLine } from "@/lib/search/insights";

const place = (id: string) => scorePlaces(sandbox, undefined, [id]).get(id)!;
const names = (xs: { restaurant: { name: string } }[]) => xs.map((x) => x.restaurant.name);

describe("query parsing", () => {
  it("folds accents, case and coffee-shop phrasing", () => {
    expect(normalizeQuery("  Best CAFÉ   in Gachibowli ")).toBe("best cafe in gachibowli");
    expect(parseQuery("best coffee shop near Hitech City")).toMatchObject({ dish: "cafe", area: "Hitech City" });
    expect(parseQuery("best coffee shop near Hitech City").areas).toContain("Gachibowli");
  });

  it("recognises a place named in the question", () => {
    expect(parseQuery("Is Cloud Nine Café legit?").placeIds).toEqual(["r34"]);
    expect(runQuery(sandbox, "Why is Velvet Bean rated so low?").foolproof.map((p) => p.restaurant.id)).toEqual(["r35"]);
  });

  it("matches nothing for things the sandbox doesn't have, everything for a generic ask", () => {
    expect(parseQuery("sushi in mars").unmatched).toBe(true);
    expect(runQuery(sandbox, "sushi in mars").foolproof).toHaveLength(0);
    expect(parseQuery("best places to eat").unmatched).toBeUndefined();
    expect(runQuery(sandbox, "Where should we eat tonight?").foolproof).toHaveLength(RESTAURANTS.length);
    // Unknown extras next to a known term are ignored, not fatal.
    expect(runQuery(sandbox, "best cafe with wifi in gachibowli").foolproof).toHaveLength(5);
  });
});

describe("café demo: best cafe in Gachibowli", () => {
  const q = runQuery(sandbox, "best cafe in Gachibowli");

  it("raw stars put the boosted café first; trust ranking puts it last", () => {
    expect(names(q.naive)[0]).toBe("Cloud Nine Café");
    expect(names(q.foolproof)[0]).toBe("Brew Theory");
    expect(names(q.foolproof).at(-1)).toBe("Cloud Nine Café");
  });

  it("lifts the smeared café that raw stars bury", () => {
    const rank = (list: typeof q.naive) => list.find((p) => p.restaurant.name === "Velvet Bean")!.rank;
    expect(rank(q.naive)).toBe(5);
    expect(rank(q.foolproof)).toBe(2);
  });

  it("summarises from the scores alone", () => {
    const s = summarize(q);
    expect(s).toContain("Brew Theory is the most trustworthy pick");
    expect(s).toContain("Raw stars would send you to Cloud Nine Café");
    expect(s).toContain("Velvet Bean moves up");
  });

  it("doesn't call a single named place a pick", () => {
    const s = summarize(runQuery(sandbox, "Is Cloud Nine Café legit?"));
    expect(s.startsWith("Cloud Nine Café rates 3.7★")).toBe(true);
    expect(s).not.toMatch(/pick/i);
  });
});

describe("insights", () => {
  it("tells bought praise from a smear, and leaves clean places alone", () => {
    expect(campaignShape(place("r34"))).toBe("boost");
    expect(campaignShape(place("r35"))).toBe("smear");
    expect(whyLine(place("r35"))).toContain("Looks like a smear");
    const seeded = new Set(RESTAURANTS.filter((r) => r.campaign).map((r) => r.id));
    for (const p of scoreAll(sandbox).values()) if (!seeded.has(p.restaurant.id)) expect(campaignShape(p), p.restaurant.name).toBeNull();
  });

  it("bins every recent review into the posting timeline, with the burst in the last weeks", () => {
    const p = place("r34");
    const bins = timeline(p, sandbox.now);
    const since = sandbox.now - 26 * 7 * DAY;
    const recent = p.scored.filter((s) => s.review.createdAt >= since);
    expect(bins.reduce((n, b) => n + b.clean + b.flagged, 0)).toBe(recent.length);
    expect(bins.reduce((n, b) => n + b.flagged, 0)).toBe(recent.filter((s) => s.suspicion >= FLAG_THRESHOLD).length);
    expect(bins.slice(-2).reduce((n, b) => n + b.flagged, 0)).toBeGreaterThanOrEqual(40);
  });

  it("only quizzes on clear-cut reviews, and mixes both kinds", () => {
    const items = reviewsToCheck(place("r34"));
    expect(items.length).toBeLessThanOrEqual(6);
    for (const s of items) {
      if (s.review.label === "fake") expect(s.suspicion).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
      else expect(s.suspicion).toBeLessThan(0.3);
    }
    expect(new Set(items.map((s) => s.review.label)).size).toBe(2);
  });

  it("explains genuine reviews with facts about the account", () => {
    const genuine = reviewsToCheck(place("r31"))[0]!;
    expect(evidenceFor(genuine).join(" ")).toMatch(/old when it posted/);
  });
});
