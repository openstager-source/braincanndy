import { useCallback, useEffect, useState } from "react";
import { ACHIEVEMENTS } from "./missions";

// Per-visitor progress, kept in this browser only. Storage can be blocked (private mode,
// strict settings), so every access is guarded and the game still works without it.
const KEY = "foolproof.progress.v1";
const KNOWN = new Set(ACHIEVEMENTS.map((a) => a.id));

export interface Progress {
  done: string[];
  quizBest: number;
}

const EMPTY: Progress = { done: [], quizBest: 0 };

function load(): Progress {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Progress> | null;
    if (!v || typeof v !== "object") return EMPTY;
    const done = Array.isArray(v.done) ? v.done.filter((d): d is string => typeof d === "string" && KNOWN.has(d)) : [];
    const quizBest = typeof v.quizBest === "number" && v.quizBest >= 0 && v.quizBest <= 6 ? Math.floor(v.quizBest) : 0;
    return { done: [...new Set(done)], quizBest };
  } catch {
    return EMPTY;
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress lasts for this visit only.
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProgress(load());
    setLoaded(true);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = fn(prev);
      if (next !== prev) save(next);
      return next;
    });
  }, []);

  const complete = useCallback(
    (ids: string[]) => update((p) => {
      const add = ids.filter((id) => KNOWN.has(id) && !p.done.includes(id));
      return add.length ? { ...p, done: [...p.done, ...add] } : p;
    }),
    [update],
  );

  const recordQuiz = useCallback((score: number) => update((p) => (score > p.quizBest ? { ...p, quizBest: score } : p)), [update]);
  const reset = useCallback(() => update(() => ({ done: [], quizBest: 0 })), [update]);

  return { progress, loaded, complete, recordQuiz, reset };
}
