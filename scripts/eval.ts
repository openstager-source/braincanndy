// Reproducible sandbox evaluation for the paper: detection metrics + "does the #1 pick flip?"
// Usage: npm run eval
import { mkdirSync, writeFileSync } from "node:fs";
import { MAX_FAKES, NO_ATTACK, type AttackConfig } from "../src/lib/sandbox/attacks";
import { generateSandbox } from "../src/lib/sandbox/generate";
import { detectionMetrics, flipCurve, runQuery, scoreAll } from "../src/lib/scoring/engine";
import { DEFAULT_QUERY } from "../src/lib/scoring/query";

const sb = generateSandbox();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function firstFlip(curve: { fakes: number; naiveRank: number; foolproofRank: number }[], axis: "boost" | "smear") {
  const flipped = (rank: number) => (axis === "boost" ? rank === 1 : rank !== 1);
  return {
    naive: curve.find((p) => flipped(p.naiveRank))?.fakes ?? null,
    foolproof: curve.find((p) => flipped(p.foolproofRank))?.fakes ?? null,
  };
}

const scenarios: { name: string; attack: AttackConfig }[] = [
  { name: "baseline (seeded campaigns only)", attack: NO_ATTACK },
  ...[5, 10, 20, 30].map((k) => ({ name: `boost ${k}`, attack: { ...NO_ATTACK, boost: k } })),
  ...[5, 10, 20, 30].map((k) => ({ name: `smear ${k}`, attack: { ...NO_ATTACK, smear: k } })),
  { name: "injection", attack: { ...NO_ATTACK, injection: true } },
  { name: "boost 20 + smear 20 + injection", attack: { ...NO_ATTACK, boost: 20, smear: 20, injection: true } },
  { name: "SMART boost 20", attack: { ...NO_ATTACK, boost: 20, smart: true } },
  { name: "SMART smear 20", attack: { ...NO_ATTACK, smear: 20, smart: true } },
];

const rows = scenarios.map(({ name, attack }) => {
  const res = runQuery(sb, DEFAULT_QUERY, attack);
  const m = detectionMetrics(scoreAll(sb, attack).values());
  return {
    scenario: name,
    naiveTop1: res.naive[0]?.restaurant.name,
    foolproofTop1: res.foolproof[0]?.restaurant.name,
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
    tp: m.tp,
    fp: m.fp,
    fn: m.fn,
  };
});

const t0 = performance.now();
const curves = {
  boost: flipCurve(sb, DEFAULT_QUERY, NO_ATTACK, "boost", MAX_FAKES),
  smear: flipCurve(sb, DEFAULT_QUERY, NO_ATTACK, "smear", MAX_FAKES),
  smartBoost: flipCurve(sb, DEFAULT_QUERY, { ...NO_ATTACK, smart: true }, "boost", MAX_FAKES),
  smartSmear: flipCurve(sb, DEFAULT_QUERY, { ...NO_ATTACK, smart: true }, "smear", MAX_FAKES),
};
const curveMs = (performance.now() - t0) / 4;

const flips = {
  boost: firstFlip(curves.boost, "boost"),
  smear: firstFlip(curves.smear, "smear"),
  smartBoost: firstFlip(curves.smartBoost, "boost"),
  smartSmear: firstFlip(curves.smartSmear, "smear"),
};

console.log(`Query: "${DEFAULT_QUERY}"\n`);
console.table(rows.map((r) => ({ ...r, precision: pct(r.precision), recall: pct(r.recall), f1: pct(r.f1) })));
console.log("Fakes needed to flip the #1 pick (null = never, up to", MAX_FAKES, "):");
console.table(flips);
console.log(`flipCurve: ${curveMs.toFixed(0)} ms per curve`);

mkdirSync("results", { recursive: true });
writeFileSync("results/sandbox-eval.json", JSON.stringify({ query: DEFAULT_QUERY, rows, flips, curves }, null, 2));
console.log("\nWrote results/sandbox-eval.json");
