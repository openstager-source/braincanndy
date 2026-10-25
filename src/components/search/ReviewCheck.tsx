"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { plainText, streamAi } from "@/lib/ai-client";
import { motionAllowed } from "@/lib/motion";
import { hashString, mulberry32, shuffle } from "@/lib/rng";
import { reviewWeight, type PlaceResult } from "@/lib/scoring/engine";
import { evidenceFor, formatDate, reviewsToCheck } from "@/lib/search/insights";
import { AlertIcon, CheckIcon, SparkIcon } from "./icons";

type Guess = "real" | "fake";
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * "Is this review real or fake?" The AI picks reviews from this place (caught fakes and clearly
 * genuine ones, in a shuffled order), the visitor guesses, and the card flips to show what gave it away.
 */
export default function ReviewCheck({ place, live }: { place: PlaceResult; live: boolean }) {
  const id = place.restaurant.id;
  const items = useMemo(() => shuffle(mulberry32(hashString(id)), reviewsToCheck(place, 6)), [place, id]);
  const [at, setAt] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [tally, setTally] = useState({ right: 0, seen: 0 });
  // A short pause before the question, as if the assistant were picking one. Skipped with motion off.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!motionAllowed()) return setReady(true);
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (items.length === 0) return null;
  const done = at >= items.length;
  const item = items[Math.min(at, items.length - 1)]!;
  const isFake = item.review.label === "fake";

  const answer = (g: Guess) => {
    if (guess) return;
    setGuess(g);
    setTally((t) => ({ right: t.right + ((g === "fake") === isFake ? 1 : 0), seen: t.seen + 1 }));
  };
  const next = () => {
    setGuess(null);
    setAt((a) => a + 1);
  };

  return (
    <section className="check" aria-labelledby="check-title">
      <div className="check-head">
        <h3 id="check-title">Is this review real or fake?</h3>
        {tally.seen > 0 && <span className="tally">{tally.right}/{tally.seen} right</span>}
      </div>
      {!ready ? (
        <p className="ai-line" role="status">
          <SparkIcon />Picking a review from {place.restaurant.name}
          <span className="typing" aria-hidden="true"><i /><i /><i /></span>
        </p>
      ) : done ? (
        <div className="check-done">
          <p>
            <b>{tally.right} of {tally.seen} right.</b> Fakes written to sound human are hard to catch by reading. Who posted them, and when, gives them away.
          </p>
          <div className="followups">
            <button
              type="button"
              onClick={() => {
                setAt(0);
                setTally({ right: 0, seen: 0 });
              }}
            >
              Check again
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="ai-line"><SparkIcon />{at === 0 ? "Quick test before you decide. Read it and make the call." : "Here’s another one."}</p>
          <div key={item.review.id} className={`flip${guess ? " revealed" : ""}`}>
            <div className="flip-inner">
              <div className="face front" inert={guess !== null}>
                <div className="review-meta">
                  <span className="stars-line" aria-label={`${item.review.rating} stars`}>{stars(item.review.rating)}</span>
                  <span>{formatDate(item.review.createdAt)}</span>
                </div>
                {/* Review text is untrusted: rendered as plain text, never HTML. */}
                <p className="review-quote">{item.review.text}</p>
                <div className="answer-row">
                  <button type="button" className="real" onClick={() => answer("real")}>Real</button>
                  <button type="button" className="fake" onClick={() => answer("fake")}>Fake</button>
                </div>
              </div>
              <div className={`face back ${isFake ? "suspicious" : "genuine"}`} inert={guess === null}>
                {guess && <Verdict place={place} item={item} guess={guess} live={live} last={at === items.length - 1} onNext={next} />}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

interface VerdictProps {
  place: PlaceResult;
  item: PlaceResult["scored"][number];
  guess: Guess;
  live: boolean;
  last: boolean;
  onNext: () => void;
}

function Verdict({ place, item, guess, live, last, onNext }: VerdictProps) {
  const isFake = item.review.label === "fake";
  const right = (guess === "fake") === isFake;
  const heading = useRef<HTMLParagraphElement>(null);
  const [ai, setAi] = useState<{ text: string; busy: boolean; error?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => abort.current?.abort();
  }, []);

  const explain = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAi({ text: "", busy: true });
    const r = await streamAi("/api/ask", { intent: "review", placeId: place.restaurant.id, reviewId: item.review.id }, (chunk) => setAi((a) => a && { ...a, text: a.text + chunk }), ctrl.signal);
    if (!ctrl.signal.aborted) setAi((a) => a && { ...a, busy: false, error: r.error });
  };

  return (
    <>
      <div className="verdict-line">
        <p ref={heading} tabIndex={-1}><strong>{right ? "You got it." : "Not this time."}</strong> {isFake ? "This one was planted." : "This one is genuine."}</p>
        <span className={`stamp2 ${isFake ? "suspicious" : "genuine"}`}>{isFake ? "Suspicious signals" : "Looks genuine"}</span>
      </div>
      <p className="verdict-why">
        {isFake ? "Part of a fake-review campaign in this fictional sandbox." : "Written by an ordinary reviewer in this fictional sandbox."} In the trust rating it counted as{" "}
        <b>{pct(reviewWeight(item.suspicion))}</b> of a normal review.
      </p>
      <ul className="evidence">
        {evidenceFor(item).map((e) => (
          <li key={e}>{isFake ? <AlertIcon className="bad" /> : <CheckIcon className="good" />}{e}</li>
        ))}
      </ul>
      {ai && (
        <p className={`ai-explain${ai.busy ? " streaming" : ""}`} aria-live="polite" aria-busy={ai.busy}>
          {ai.error ? <span className="ask-error">{ai.error}</span> : plainText(ai.text)}
        </p>
      )}
      <div className="followups">
        {live && !ai?.busy && !ai?.text && <button type="button" onClick={explain}><SparkIcon />Explain with AI</button>}
        <button type="button" onClick={onNext}>{last ? "See my score" : "Next review →"}</button>
      </div>
    </>
  );
}
