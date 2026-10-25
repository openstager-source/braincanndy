"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { plainText, streamAi } from "@/lib/ai-client";
import { NO_ATTACK } from "@/lib/sandbox/attacks";
import type { QueryResult } from "@/lib/scoring/engine";
import { summarize } from "@/lib/search/insights";
import SetupCheck from "../SetupCheck";
import { SparkIcon } from "./icons";

interface Live {
  text: string;
  model?: string;
  error?: string;
  done: boolean;
}

// Answers already streamed during this visit, so going back to a search doesn't call the AI again.
const answered = new Map<string, Live>();

const modelName = (m?: string) => (m ? m.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ") : "Gemini");

/**
 * The answer at the top of the results. The code-written summary shows at once; with live AI on,
 * Gemini's explanation of the same ranking streams in over it. Gemini can't change the order.
 */
export default function AiOverview({ query, result, live }: { query: string; result: QueryResult; live: boolean }) {
  const instant = summarize(result);
  const [ai, setAi] = useState<Live | null>(() => answered.get(query) ?? null);

  useEffect(() => {
    if (!live || answered.has(query)) return;
    const ctrl = new AbortController();
    let text = "";
    let frame = 0;
    setAi({ text: "", done: false });
    // Chunks can arrive faster than the screen refreshes; paint at most once per frame.
    const onText = (chunk: string) => {
      text += chunk;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        setAi((a) => a && { ...a, text });
      });
    };
    void streamAi("/api/answer", { mode: "foolproof", query, attack: NO_ATTACK }, onText, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      cancelAnimationFrame(frame);
      const final: Live = { text, model: r.model, error: r.error, done: true };
      if (r.ok && text.trim()) answered.set(query, final);
      setAi(final);
    });
    return () => {
      ctrl.abort();
      cancelAnimationFrame(frame);
    };
  }, [query, live]);

  const body = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  const failed = Boolean(ai?.error) || (ai?.done === true && !ai.text.trim());
  const showAi = Boolean(ai?.text) && !failed;
  const streaming = Boolean(ai) && !ai!.done;
  const status = !live || failed ? "Instant summary" : showAi ? modelName(ai!.model) : "Asking Gemini…";
  const shownText = showAi ? plainText(ai!.text) : instant;

  // Does the text overflow the fixed-height box? Then offer "Show more".
  useLayoutEffect(() => {
    const el = body.current;
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [shownText, open]);

  return (
    <section className="overview glass" aria-labelledby="overview-title">
      <div className="overview-head">
        <h2 id="overview-title"><SparkIcon />AI Overview</h2>
        <span className="live-pill"><i className={`live-dot${live && !failed ? "" : " off"}`} aria-hidden="true" />{status}</span>
      </div>
      <div ref={body} id="overview-text" className={`ai-body${clipped ? " clipped" : ""}${open ? " open" : ""}`} aria-live="polite" aria-busy={streaming}>
        <p key={showAi ? "ai" : "instant"} className={`ai-text${showAi && streaming ? " streaming" : ""}`}>{shownText}</p>
      </div>
      {/* Always laid out (hidden when not needed), so it can't push the results down when it appears. */}
      <button
        type="button"
        className={`more-text${clipped || open ? "" : " idle"}`}
        aria-expanded={open}
        aria-controls="overview-text"
        aria-hidden={!clipped && !open}
        tabIndex={clipped || open ? 0 : -1}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Show less" : "Show more"}
      </button>
      <p className="note">
        Ranked by code from how and when each review was posted.{live ? " Gemini only explains the ranking; it can’t change it." : " Live AI explanations run on the full site."}
      </p>
      {ai?.error && (
        <div className="ov-error">
          <p role="status">Live AI: {ai.error}</p>
          <SetupCheck />
        </div>
      )}
    </section>
  );
}
