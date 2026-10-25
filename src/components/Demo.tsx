"use client";

import { startTransition, useCallback, useRef, useState } from "react";
import { ACHIEVEMENTS, MISSIONS, QUIZ_BADGES, QUIZ_XP_PER_CORRECT, levelFor, totalXp } from "@/lib/game/missions";
import { useProgress } from "@/lib/game/progress";
import Detective from "./Detective";
import { Fx, useFx } from "./Fx";
import Lab from "./Lab";

type Tab = "lab" | "detective";

/** `live` is false for the static preview, which has no server to call the AI. */
export default function Demo({ live = true }: { live?: boolean }) {
  const [tab, setTab] = useState<Tab>("lab");
  const { progress, loaded, complete, recordQuiz, reset } = useProgress();
  const { toasts, burst, celebrate } = useFx();
  const awarded = useRef(new Set<string>());

  const xp = totalXp(progress.done, progress.quizBest);
  const lvl = levelFor(xp);
  const badgeTotal = ACHIEVEMENTS.length - (live ? 0 : MISSIONS.filter((m) => m.requiresLive).length);

  const award = useCallback(
    (ids: string[]) => {
      const fresh = ids.filter((id) => !awarded.current.has(id) && !progress.done.includes(id));
      if (fresh.length === 0) return;
      fresh.forEach((id) => awarded.current.add(id));
      // Low priority: the player's tap paints first, the celebration follows a frame later.
      startTransition(() => {
        complete(fresh);
        for (const id of fresh) {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          if (a) celebrate(a.title, `+${a.xp} XP · ${a.lesson}`);
        }
      });
    },
    [complete, celebrate, progress.done],
  );

  const finishQuiz = useCallback(
    (score: number) => {
      if (score > progress.quizBest) {
        celebrate(`New best: ${score}/6`, `+${(score - progress.quizBest) * QUIZ_XP_PER_CORRECT} XP`);
        recordQuiz(score);
      }
      award(QUIZ_BADGES.filter((b) => score >= b.minScore).map((b) => b.id));
    },
    [progress.quizBest, recordQuiz, celebrate, award],
  );

  const tabButton = (id: Tab, label: string) => (
    <button role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <div className="stack">
      <div className="playerbar">
        <div
          className="tabs"
          role="tablist"
          aria-label="Game mode"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") setTab((t) => (t === "lab" ? "detective" : "lab"));
          }}
        >
          {tabButton("lab", "Attack lab")}
          {tabButton("detective", "Spot the fake")}
        </div>
        <div className="xp">
          <span className="lvl">Lv {lvl.level} · {lvl.name}</span>
          <span className="bar" role="progressbar" aria-label="Progress to the next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lvl.progress * 100)}>
            <span style={{ width: `${lvl.progress * 100}%` }} />
          </span>
          <span className="chip saffron">{xp} XP</span>
          <span className="chip">{progress.done.length}/{badgeTotal} badges</span>
          {progress.done.length + progress.quizBest > 0 && (
            <button
              className="ghost small"
              onClick={() => {
                awarded.current.clear();
                reset();
              }}
            >
              Reset progress
            </button>
          )}
        </div>
      </div>

      <div id="panel-lab" role="tabpanel" aria-labelledby="tab-lab" hidden={tab !== "lab"}>
        <Lab live={live} done={progress.done} ready={loaded} onMissions={award} />
      </div>
      <div id="panel-detective" role="tabpanel" aria-labelledby="tab-detective" hidden={tab !== "detective"}>
        <Detective best={progress.quizBest} onFinish={finishQuiz} />
      </div>
      <Fx toasts={toasts} burst={burst} />
    </div>
  );
}
