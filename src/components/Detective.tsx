"use client";

import { useMemo, useState } from "react";
import { QUIZ_XP_PER_CORRECT } from "@/lib/game/missions";
import { QUIZ_FAKES, QUIZ_LENGTH, buildQuiz } from "@/lib/game/quiz";
import { sandbox } from "@/lib/sandbox/instance";

type Guess = "real" | "fake";

function verdictTitle(score: number, total: number): string {
  if (score === total) return "Perfect case";
  if (score >= 4) return "Sharp eye";
  if (score >= 2) return "The fakes got you a few times";
  return "The fakes got you";
}

export default function Detective({ best, onFinish }: { best: number; onFinish: (score: number) => void }) {
  const [started, setStarted] = useState(false);
  // Built on first play, not on page load.
  const quiz = useMemo(() => (started ? buildQuiz(sandbox) : []), [started]);
  const [round, setRound] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);

  const right = (k: number) => (guesses[k] === "fake") === quiz[k]!.isFake;
  const score = guesses.filter((_, k) => right(k)).length;
  const detectorScore = quiz.filter((q) => q.detectorSaysFake === q.isFake).length;
  const answered = guesses.length > round;

  const guess = (g: Guess) => {
    if (!answered) setGuesses((gs) => [...gs, g]);
  };
  const next = () => {
    const n = round + 1;
    setRound(n);
    if (n === quiz.length) onFinish(score);
  };
  const restart = () => {
    setGuesses([]);
    setRound(0);
  };

  if (!started) {
    return (
      <section className="card quiz stack" aria-labelledby="quiz-title">
        <span className="eyebrow">Detective mode</span>
        <h2 id="quiz-title" style={{ fontSize: 30 }}>Spot the fake</h2>
        <p className="lede">
          {QUIZ_LENGTH} reviews. {QUIZ_FAKES} were written to deceive, in a voice that sounds human. Read each one and make the call. Then see what the detector saw.
        </p>
        <div className="scoreline">
          <div className="score"><span className="small muted">Your best</span><b>{best}/{QUIZ_LENGTH}</b></div>
          <div className="score"><span className="small muted">Per right call</span><b>+{QUIZ_XP_PER_CORRECT} XP</b></div>
        </div>
        <button className="go" style={{ alignSelf: "flex-start" }} onClick={() => setStarted(true)}>Open the case</button>
      </section>
    );
  }

  if (round >= quiz.length) {
    return (
      <section className="card quiz stack" aria-labelledby="quiz-done">
        <span className="eyebrow">Case closed</span>
        <h2 id="quiz-done" style={{ fontSize: 30 }}>{verdictTitle(score, quiz.length)}</h2>
        <div className="scoreline">
          <div className="score"><span className="small muted">You, reading the words</span><b>{score}/{quiz.length}</b></div>
          <div className="score"><span className="small muted">Foolproof, reading behaviour</span><b>{detectorScore}/{quiz.length}</b></div>
        </div>
        <p>
          Fakes written to sound human are hard to catch by reading. Who posted them, and when, gives them away. That&rsquo;s why Foolproof scores behaviour, not words.
        </p>
        <p className="small muted">Your best score counts toward XP. Badges: Sharp eye at 4+, Perfect case at {quiz.length}/{quiz.length}.</p>
        <button className="go" style={{ alignSelf: "flex-start" }} onClick={restart}>Play again</button>
      </section>
    );
  }

  const item = quiz[round]!;
  return (
    <section className="card quiz evidence-card" aria-labelledby="quiz-round">
      <div className="colhead" style={{ marginBottom: 0, alignItems: "center" }}>
        <span id="quiz-round" className="eyebrow">Review {round + 1} of {quiz.length}</span>
        <div className="dots" aria-hidden="true">
          {quiz.map((q, k) => <i key={q.id} className={k < guesses.length ? (right(k) ? "right" : "wrong") : k === round ? "now" : ""} />)}
        </div>
      </div>
      <div>
        <h3>{item.restaurant.name}</h3>
        <p className="small muted">
          {item.restaurant.area} · <span className="mono">{"★".repeat(item.review.rating)}{"☆".repeat(5 - item.review.rating)}</span>
        </p>
      </div>
      {/* Plain text, never HTML. */}
      <p className="quote">{item.review.text}</p>

      {!answered ? (
        <div className="verdicts">
          <button className="real" onClick={() => guess("real")}>Real review</button>
          <button className="fake" onClick={() => guess("fake")}>Fake review</button>
        </div>
      ) : (
        <div className="reveal" aria-live="polite">
          <div className="colhead" style={{ marginBottom: 0, alignItems: "center" }}>
            <strong>{right(round) ? "Right call." : "Not this time."} It was {item.isFake ? "fake" : "real"}.</strong>
            <span className={`stamp ${item.isFake ? "fooled" : "holds"}`}>{item.isFake ? "Fake" : "Real"}</span>
          </div>
          <p className="small">
            <b>What the detector saw:</b> {Math.round(item.suspicion * 100)}% suspicious, so it called it {item.detectorSaysFake ? "fake" : "real"}.
          </p>
          <ul className="small">
            {item.evidence.map((e) => <li key={e}>{e}</li>)}
          </ul>
          <button className="primary" style={{ justifySelf: "start" }} onClick={next}>
            {round + 1 === quiz.length ? "See results" : "Next review"}
          </button>
        </div>
      )}
    </section>
  );
}
