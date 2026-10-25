// Hidden/bidi characters attackers use to smuggle instructions past filters.
const INVISIBLE = /[­​-‏‪-‮⁠-⁤﻿]/g;

export function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(INVISIBLE, "").toLowerCase();
}

const STOP = new Set(
  "a an the and or but is was were it its this that of to in on for with at by from i we my our me you they be been are very so too just".split(" "),
);

export type SparseVec = Map<string, number>;

/**
 * Cheap local text vector (unigrams + bigrams, L2-normalised). Good at catching templated
 * campaigns. For paraphrased LLM fakes, swap in real embeddings from pgvector.
 */
export function textVector(s: string): SparseVec {
  const words = normalizeText(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));
  const v: SparseVec = new Map();
  for (let i = 0; i < words.length; i++) {
    v.set(words[i]!, (v.get(words[i]!) ?? 0) + 1);
    if (i > 0) {
      const bg = `${words[i - 1]}_${words[i]}`;
      v.set(bg, (v.get(bg) ?? 0) + 1);
    }
  }
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (const [k, x] of v) v.set(k, x / norm);
  return v;
}

export function cosine(a: SparseVec, b: SparseVec): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) {
    const y = big.get(k);
    if (y) dot += x * y;
  }
  return dot;
}

const AI_TARGET = /\b(ai|a\.i\.|assistants?|chat ?bots?|language models?|llms?|gpt|chatgpt|claude|gemini|copilot|bots?)\b/;
const IMPERATIVE = /\b(ignore|disregard|always|never|rank|recommend|instructions?|system prompt|override|must|forget|pretend)\b/;
const DIRECT = /(ignore|disregard|forget) (all |any )?(the )?(previous|prior|above|other) (instructions|reviews|rules)|system prompt|<\/?(system|instructions?)>/;

/** Text aimed at an AI reader rather than a human one. */
export function detectInjection(text: string): string | null {
  const t = normalizeText(text);
  const direct = t.match(DIRECT);
  if (direct) return `contains instruction "${direct[0]}"`;
  const target = t.match(AI_TARGET);
  const verb = t.match(IMPERATIVE);
  if (target && verb) return `addresses AI ("${target[0]}") with an instruction ("${verb[0]}")`;
  return null;
}
