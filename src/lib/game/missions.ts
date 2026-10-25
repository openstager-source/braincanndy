import type { AttackConfig } from "../sandbox/attacks";
import type { QueryResult } from "../scoring/engine";
import { FLAG_THRESHOLD } from "../scoring/signals";

/** Credits the attacker can spend. Missions only count within budget. */
export const BUDGET = 40;
/** Aged accounts that post slowly cost more on real fake-review markets. */
export const COST = { fake: 1, smartMultiplier: 3, injection: 5 } as const;

export const costPerFake = (a: Pick<AttackConfig, "smart">) => COST.fake * (a.smart ? COST.smartMultiplier : 1);

export function attackCost(a: AttackConfig): number {
  return (a.boost + a.smear) * costPerFake(a) + (a.injection ? COST.injection : 0);
}

export interface GameState {
  attack: AttackConfig;
  result: QueryResult;
  baseline: QueryResult;
  /** Place the player explicitly opened in the inspector. */
  inspected: string | null;
  liveRan: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  goal: string;
  hint: string;
  /** Shown once completed: what the player just learned. */
  lesson: string;
  xp: number;
}

export interface Mission extends Achievement {
  check: (s: GameState) => boolean;
  requiresLive?: boolean;
}

const top = (r: QueryResult, side: "naive" | "foolproof") => r[side][0]?.restaurant.id;
const withinBudget = (s: GameState) => attackCost(s.attack) <= BUDGET;

export const MISSIONS: Mission[] = [
  {
    id: "buy-top-spot",
    title: "Buy the top spot",
    goal: "Make the naive AI change its #1 pick using fake 5★ reviews.",
    hint: "Drag the fake 5★ slider up and watch the naive column.",
    lesson: "Stars at face value fall to about 18 cheap fakes.",
    xp: 100,
    check: (s) =>
      withinBudget(s) && s.attack.boost > 0 && !s.attack.injection &&
      top(s.result, "naive") === s.attack.boostTarget && top(s.result, "naive") !== top(s.baseline, "naive"),
  },
  {
    id: "smear",
    title: "Smear campaign",
    goal: "Knock the best place off #1 in the naive AI with fake 1★ reviews only.",
    hint: "Set fake 5★ to 0, then add fake 1★ reviews to the current #1.",
    lesson: "Smears are cheap: a couple of 1★ fakes can flip a close race.",
    xp: 100,
    check: (s) =>
      withinBudget(s) && s.attack.smear > 0 && s.attack.boost === 0 && !s.attack.injection &&
      s.attack.smearTarget === top(s.baseline, "naive") && top(s.result, "naive") !== top(s.baseline, "naive"),
  },
  {
    id: "whisper",
    title: "Whisper to the machine",
    goal: "Get the naive AI to follow an instruction hidden in a review.",
    hint: "Turn on the hidden instruction tool.",
    lesson: "When review text goes straight into the prompt, a review can give the AI orders.",
    xp: 100,
    check: (s) => withinBudget(s) && s.attack.injection && s.result.naive[0]?.obeyedInjection === true,
  },
  {
    id: "evidence",
    title: "Read the evidence",
    goal: "Open a restaurant with suspicious reviews and see why they were flagged.",
    hint: "Click a place marked “suspicious” in the Foolproof column.",
    lesson: "Every flag shows its reason, so a person can check the call.",
    xp: 50,
    check: (s) => s.inspected !== null && (s.result.places.get(s.inspected)?.flagged ?? 0) > 0,
  },
  {
    id: "ghost",
    title: "Ghost writer",
    goal: "Get one fake review past the detector (under 50% suspicious).",
    hint: "Cheap accounts posting in a burst get caught. Try smart accounts.",
    lesson: "Aged accounts posting slowly look like real people. That's the expensive attack.",
    xp: 150,
    check: (s) =>
      withinBudget(s) &&
      [...s.result.places.values()].some((p) =>
        p.scored.some((r) => r.review.label === "fake" && (r.review.attack === "boost" || r.review.attack === "smear") && r.suspicion < FLAG_THRESHOLD),
      ),
  },
  {
    id: "boss",
    title: "Boss: fool Foolproof",
    goal: "Change Foolproof's #1 pick without going over budget.",
    hint: "Foolproof trusts patient, aged accounts. Look for a close race at the top.",
    lesson: "You found the open problem: a few slow, aged-account reviews can still tip a close race. Catching these is the research.",
    xp: 300,
    check: (s) => withinBudget(s) && top(s.result, "foolproof") !== top(s.baseline, "foolproof"),
  },
  {
    id: "live",
    title: "Ask the real AI",
    goal: "Run the live comparison with Gemini.",
    hint: "Scroll to “Ask the real AI” and press Ask both.",
    lesson: "Real models can be fooled too, and their answers change from run to run.",
    xp: 50,
    requiresLive: true,
    check: (s) => s.liveRan,
  },
];

export const QUIZ_XP_PER_CORRECT = 20;

export const QUIZ_BADGES: (Achievement & { minScore: number })[] = [
  {
    id: "sharp-eye",
    title: "Sharp eye",
    goal: "Score 4 or more in Spot the fake.",
    hint: "Read closely, then check what the detector saw.",
    lesson: "You beat the odds. Most people can't tell well-written fakes from real reviews.",
    xp: 50,
    minScore: 4,
  },
  {
    id: "perfect-case",
    title: "Perfect case",
    goal: "Get every review right in Spot the fake.",
    hint: "The words alone won't do it every time.",
    lesson: "Flawless. Even so, posting patterns are a more reliable tell than words.",
    xp: 100,
    minScore: 6,
  },
];

export const ACHIEVEMENTS: Achievement[] = [...MISSIONS, ...QUIZ_BADGES];

export const LEVELS = [
  { name: "Rookie", xp: 0 },
  { name: "Investigator", xp: 150 },
  { name: "Detective", xp: 400 },
  { name: "Inspector", xp: 700 },
  { name: "Chief inspector", xp: 1000 },
] as const;

export function totalXp(done: readonly string[], quizBest: number): number {
  const fromAchievements = ACHIEVEMENTS.filter((a) => done.includes(a.id)).reduce((sum, a) => sum + a.xp, 0);
  return fromAchievements + quizBest * QUIZ_XP_PER_CORRECT;
}

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.xp) i++;
  const floor = LEVELS[i]!.xp;
  const next = LEVELS[i + 1]?.xp;
  return { level: i + 1, name: LEVELS[i]!.name, xp, next, progress: next === undefined ? 1 : (xp - floor) / (next - floor) };
}
