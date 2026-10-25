// Hidden/bidi characters attackers use to smuggle instructions past filters.
const INVISIBLE = /[­​-‏‪-‮⁠-⁤﻿]/g;

export function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(INVISIBLE, "").toLowerCase();
}

const STOP = new Set(
  "a an the and or but is was were it its this that of to in on for with at by from i we my our me you they be been are very so too just".split(" "),
);

/** Token ids sorted ascending, with matching L2-normalised weights. */
export interface SparseVec {
  ids: Int32Array;
  w: Float64Array;
}

// Tokens map to small integers so similarity is a fast merge over two sorted arrays.
const TOKEN_IDS = new Map<string, number>();
const tokenId = (t: string) => {
  let id = TOKEN_IDS.get(t);
  if (id === undefined) TOKEN_IDS.set(t, (id = TOKEN_IDS.size));
  return id;
};

/**
 * Cheap local text vector (unigrams + bigrams, L2-normalised). Good at catching templated
 * campaigns. For paraphrased LLM fakes, swap in real embeddings from pgvector.
 */
export function textVector(s: string): SparseVec {
  const words = normalizeText(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));
  const counts = new Map<number, number>();
  const add = (t: string) => {
    const id = tokenId(t);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (let i = 0; i < words.length; i++) {
    add(words[i]!);
    if (i > 0) add(`${words[i - 1]}_${words[i]}`);
  }
  const ids = Int32Array.from(counts.keys()).sort();
  const w = new Float64Array(ids.length);
  let norm = 0;
  for (const x of counts.values()) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  ids.forEach((id, i) => (w[i] = counts.get(id)! / norm));
  return { ids, w };
}

export function cosine(a: SparseVec, b: SparseVec): number {
  let i = 0;
  let j = 0;
  let dot = 0;
  while (i < a.ids.length && j < b.ids.length) {
    const x = a.ids[i]!;
    const y = b.ids[j]!;
    if (x === y) dot += a.w[i++]! * b.w[j++]!;
    else if (x < y) i++;
    else j++;
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
