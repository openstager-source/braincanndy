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

export default function LivePanel({ query, attack }: { query: string; attack: AttackConfig }) {
  const [answers, setAnswers] = useState<Record<Mode, string>>({ naive: "", foolproof: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setAnswers({ naive: "", foolproof: "" });

    const run = async (mode: Mode) => {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query, attack, turnstileToken: token ?? undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
        throw new Error(msg ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setAnswers((a) => ({ ...a, [mode]: a[mode] + chunk }));
      }
    };

    try {
      await Promise.all([run("naive"), run("foolproof")]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
      // Turnstile tokens are single-use.
      if (SITE_KEY && window.turnstile && widgetId.current) {
        window.turnstile.reset(widgetId.current);
        setToken(null);
      }
    }
  }, [query, attack, token]);

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
      {error && <p className="tag danger" role="alert">{error}</p>}
      <div className="grid2">
        <div>
          <h3 style={{ color: "var(--naive)" }}>Naive AI (live)</h3>
          <p className="answer" aria-live="polite">{answers.naive || (busy ? "…" : "")}</p>
        </div>
        <div>
          <h3 style={{ color: "var(--fool)" }}>Foolproof (live)</h3>
          <p className="answer" aria-live="polite">{answers.foolproof || (busy ? "…" : "")}</p>
        </div>
      </div>
    </section>
  );
}
