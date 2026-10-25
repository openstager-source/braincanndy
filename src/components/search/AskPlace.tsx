"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { plainText, streamAi } from "@/lib/ai-client";
import type { PlaceResult } from "@/lib/scoring/engine";
import { whyLine } from "@/lib/search/insights";
import { ArrowIcon, SparkIcon } from "./icons";

interface Answer {
  question: string;
  text: string;
  busy: boolean;
  error?: string;
}

/** Without live AI, questions about trust are answered from the scores; anything else needs the AI. */
function offlineAnswer(place: PlaceResult, question: string): string {
  const facts = `${place.restaurant.name} has a ${place.trustRating.toFixed(1)}★ trust rating (${place.naiveRating.toFixed(1)}★ in raw stars) from ${place.reviewCount} reviews. ${whyLine(place)}`;
  if (/trust|real|fake|legit|rating|review|honest|genuine/i.test(question)) return facts;
  return `Open-ended questions are answered by the live AI on the full site. What the scores say: ${facts}`;
}

export default function AskPlace({ place, live }: { place: PlaceResult; live: boolean }) {
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const r = place.restaurant;
  const suggestions = ["Can I trust the rating?", "What do people like here?", `Is it worth ₹${r.priceForOne}?`];

  const ask = async (raw: string) => {
    const question = raw.replace(/\s+/g, " ").trim().slice(0, 200);
    if (question.length < 2 || answer?.busy) return;
    setDraft("");
    if (!live) return setAnswer({ question, text: offlineAnswer(place, question), busy: false });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAnswer({ question, text: "", busy: true });
    const res = await streamAi("/api/ask", { intent: "question", placeId: r.id, question }, (chunk) => setAnswer((a) => a && { ...a, text: a.text + chunk }), ctrl.signal);
    if (!ctrl.signal.aborted) setAnswer((a) => a && { ...a, busy: false, error: res.error });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  return (
    <section className="ask" aria-labelledby="ask-title">
      <h3 id="ask-title" className="section-title">Ask about {r.name}</h3>
      <div className="ask-chips">
        {suggestions.map((s) => <button key={s} type="button" onClick={() => void ask(s)} disabled={answer?.busy}>{s}</button>)}
      </div>
      <form onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask anything about this place" aria-label={`Ask about ${r.name}`} maxLength={200} enterKeyHint="send" />
        <button type="submit" className="sb-btn sb-go" aria-label="Ask" disabled={answer?.busy}><ArrowIcon /></button>
      </form>
      {answer && (
        <div className="ask-result" aria-live="polite" aria-busy={answer.busy}>
          <p className="ask-q">{answer.question}</p>
          {answer.error ? (
            <p className="ask-error">{answer.error}</p>
          ) : (
            <p className={`ask-answer${answer.busy ? " streaming" : ""}`}><SparkIcon />{plainText(answer.text)}</p>
          )}
        </div>
      )}
    </section>
  );
}
