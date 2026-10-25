"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttackConfig } from "@/lib/sandbox/attacks";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
type Mode = "naive" | "foolproof";
interface Answer {
  text: string;
  model?: string;
  error?: string;
}
const EMPTY: Record<Mode, Answer> = { naive: { text: "" }, foolproof: { text: "" } };

const MESSAGES: Record<string, string> = {
  forbidden: "Blocked: requests must come from this site.",
  too_large: "The request was invalid. Reload the page and try again.",
  bad_request: "The request was invalid. Reload the page and try again.",
  rate_limited: "Too many requests. Wait a minute and try again.",
  bot_check: "The bot check didn't pass. Complete it and try again.",
  no_match: "No sandbox restaurants match this question.",
  not_configured: "Live AI isn't set up on this site yet. The site owner needs to add GEMINI_API_KEY in Netlify and redeploy.",
  key_rejected: "Gemini rejected the API key. The site owner needs to check GEMINI_API_KEY in Netlify.",
  ai_busy: "Gemini is busy or slow right now. Try again in a few seconds.",
};

async function errorFor(res: Response): Promise<string> {
  const code = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  if (code && MESSAGES[code]) return MESSAGES[code]!;
  if (res.status === 429) return MESSAGES.rate_limited!;
  if (res.status === 404 || res.status === 405) return "Live AI isn't available on this copy of the site. It runs on the Netlify deployment.";
  return `Something went wrong (HTTP ${res.status}). Try again.`;
}

export default function LivePanel({ query, attack, onDone }: { query: string; attack: AttackConfig; onDone?: () => void }) {
  const [answers, setAnswers] = useState<Record<Mode, Answer>>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Load Turnstile only after the user opens the panel, so it never costs LCP.
  useEffect(() => {
    if (!open || !SITE_KEY || widgetId.current) return;
    const render = () => {
      if (widget.current && window.turnstile && !widgetId.current) {
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: SITE_KEY,
          callback: setToken,
          "expired-callback": () => setToken(null),
        });
      }
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [open]);

  const ask = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setAnswers(EMPTY);
    const patch = (mode: Mode, a: Partial<Answer>) => setAnswers((s) => ({ ...s, [mode]: { ...s[mode], ...a } }));

    const start = async (mode: Mode, withToken: boolean): Promise<Response | null> => {
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, query, attack, turnstileToken: withToken ? token ?? undefined : undefined }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          patch(mode, { error: await errorFor(res) });
          return null;
        }
        patch(mode, { model: res.headers.get("X-Model") ?? undefined });
        return res;
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch(mode, { error: "Couldn't reach the server. Check your connection and try again." });
        return null;
      }
    };

    const read = async (mode: Mode, res: Response | null) => {
      if (!res?.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          setAnswers((s) => ({ ...s, [mode]: { ...s[mode], text: s[mode].text + chunk } }));
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch(mode, { error: "The answer was interrupted. Try again." });
      }
    };

    // The first request spends the one-time Turnstile token and gets a short-lived pass cookie,
    // so the second request starts once the first has been accepted.
    const naive = await start("naive", true);
    const foolproof = start("foolproof", false);
    await Promise.all([read("naive", naive), foolproof.then((res) => read("foolproof", res))]);

    setBusy(false);
    if (naive || (await foolproof)) onDone?.();
    if (SITE_KEY && window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current);
      setToken(null);
    }
  }, [query, attack, token, onDone]);

  if (!open) {
    return (
      <section className="card">
        <div className="colhead">
          <h2 style={{ margin: 0 }}>Ask the real AI</h2>
          <button className="primary" onClick={() => setOpen(true)}>Run live with Gemini</button>
        </div>
        <p className="muted small">Sends the same data to Gemini twice: once naively (raw stars + review text), once through Foolproof (code ranks, AI only explains).</p>
      </section>
    );
  }

  const canAsk = !busy && (!SITE_KEY || !!token);
  return (
    <section className="card stack">
      <div className="colhead">
        <h2 style={{ margin: 0 }}>Ask the real AI</h2>
        <button className="primary" onClick={ask} disabled={!canAsk}>{busy ? "Thinking…" : "Ask both"}</button>
      </div>
      {SITE_KEY && <div ref={widget} />}
      <div className="grid2">
        <LiveAnswer title="Naive AI (live)" color="var(--naive)" answer={answers.naive} busy={busy} />
        <LiveAnswer title="Foolproof (live)" color="var(--fool)" answer={answers.foolproof} busy={busy} />
      </div>
    </section>
  );
}

// AI text is rendered as plain text (never HTML), so drop stray Markdown markers.
const plain = (s: string) => s.replace(/\*\*|__/g, "").replace(/^#{1,6}\s+/gm, "");

function LiveAnswer({ title, color, answer, busy }: { title: string; color: string; answer: Answer; busy: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ color }}>{title}</h3>
      {answer.error && <p className="tag danger" role="alert">{answer.error}</p>}
      <p className="answer" aria-live="polite">{plain(answer.text) || (busy && !answer.error ? "…" : "")}</p>
      {answer.model && <p className="small muted">Answered by {answer.model}</p>}
    </div>
  );
}
