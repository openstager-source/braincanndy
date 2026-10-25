import { describe, expect, it } from "vitest";
import { BUDGET, MISSIONS, attackCost, levelFor, totalXp, type GameState } from "@/lib/game/missions";
import { buildQuiz } from "@/lib/game/quiz";
import { NO_ATTACK, type AttackConfig } from "@/lib/sandbox/attacks";
import { generateSandbox } from "@/lib/sandbox/generate";
import { runQuery } from "@/lib/scoring/engine";
import { DEFAULT_QUERY } from "@/lib/scoring/query";

const sb = generateSandbox();
const baseline = runQuery(sb, DEFAULT_QUERY, NO_ATTACK);
const state = (attack: Partial<AttackConfig>, extra: Partial<GameState> = {}): GameState => ({
  attack: { ...NO_ATTACK, ...attack },
  result: runQuery(sb, DEFAULT_QUERY, { ...NO_ATTACK, ...attack }),
  baseline,
  inspected: null,
  liveRan: false,
  ...extra,
});
const done = (s: GameState) => MISSIONS.filter((m) => m.check(s)).map((m) => m.id);

describe("missions", () => {
  it("none complete before the player does anything", () => {
    expect(done(state({}))).toEqual([]);
  });

  it("each mission can be won within budget", () => {
    const wins: [string, Partial<AttackConfig>, Partial<GameState>?][] = [
      ["buy-top-spot", { boost: 20 }],
      ["smear", { smear: 3 }],
      ["whisper", { injection: true }],
      ["evidence", { boost: 10 }, { inspected: "r05" }],
      ["ghost", { boost: 1, smart: true }],
      ["boss", { smear: 3, smart: true }],
      ["live", {}, { liveRan: true }],
    ];
    for (const [id, attack, extra] of wins) {
      const s = state(attack, extra);
      expect(attackCost(s.attack), id).toBeLessThanOrEqual(BUDGET);
      expect(done(s), id).toContain(id);
    }
  });

  it("cheap bursts from fresh accounts never beat Foolproof", () => {
    expect(done(state({ boost: 30, smear: 0 }))).not.toContain("boss");
    expect(done(state({ smear: 30 }))).not.toContain("boss");
  });

  it("going over budget pauses missions", () => {
    const s = state({ boost: 20, smart: true }); // 60 credits
    expect(attackCost(s.attack)).toBeGreaterThan(BUDGET);
    expect(done(s)).not.toContain("ghost");
  });

  it("levels follow XP", () => {
    expect(levelFor(0).name).toBe("Rookie");
    expect(levelFor(totalXp(["buy-top-spot", "smear"], 0)).name).toBe("Investigator");
    expect(levelFor(5000).progress).toBe(1);
  });
});

describe("spot the fake", () => {
  const quiz = buildQuiz(sb);

  it("has three fakes and three real reviews", () => {
    expect(quiz).toHaveLength(6);
    expect(quiz.filter((q) => q.isFake)).toHaveLength(3);
  });

  it("the detector gets every round right, from behaviour alone", () => {
    for (const q of quiz) expect(q.detectorSaysFake, q.review.text).toBe(q.isFake);
  });

  it("fakes read like real reviews (no paid-review templates)", () => {
    for (const q of quiz.filter((q) => q.isFake)) expect(q.review.text).not.toMatch(/!!|must visit|highly recommend/i);
  });

  it("is the same for every visitor", () => {
    expect(buildQuiz(sb).map((q) => q.id)).toEqual(quiz.map((q) => q.id));
  });
});
