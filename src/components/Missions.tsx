"use client";

import { useState } from "react";
import { BUDGET, MISSIONS } from "@/lib/game/missions";
import { StatusIcon } from "./icons";

export default function Missions({ done, live }: { done: string[]; live: boolean }) {
  const [hint, setHint] = useState<string | null>(null);
  const playable = MISSIONS.filter((m) => !m.requiresLive || live);
  const next = playable.find((m) => !done.includes(m.id))?.id;
  const cleared = playable.filter((m) => done.includes(m.id)).length;

  return (
    <section className="card" aria-labelledby="missions-title">
      <div className="colhead">
        <div>
          <h2 id="missions-title">Case board</h2>
          <p className="small muted">Missions only count within your {BUDGET}-credit budget.</p>
        </div>
        <span className="chip saffron">{cleared}/{playable.length} cleared</span>
      </div>
      <ol className="missions">
        {MISSIONS.map((m) => {
          const locked = m.requiresLive === true && !live;
          const isDone = done.includes(m.id);
          const state = isDone ? "done" : locked ? "locked" : m.id === next ? "next" : "todo";
          return (
            <li key={m.id} className={`mission ${state}`}>
              <StatusIcon state={state} />
              <div style={{ minWidth: 0 }}>
                <div className="t">{m.title}</div>
                <div className="why">{isDone ? m.lesson : locked ? "Runs on the full site, where the live AI is available." : m.goal}</div>
                {state !== "done" && !locked && hint === m.id && <div className="hint">Hint: {m.hint}</div>}
              </div>
              <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                <span className={`chip ${isDone ? "mint" : "saffron"}`}>+{m.xp} XP</span>
                {!isDone && !locked && (
                  <button className="ghost small" aria-expanded={hint === m.id} onClick={() => setHint(hint === m.id ? null : m.id)}>
                    {hint === m.id ? "Hide hint" : "Hint"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
