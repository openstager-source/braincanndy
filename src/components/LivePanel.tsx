"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttackConfig } from "@/lib/sandbox/attacks";
import type { HealthReport } from "@/lib/server/health";

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
  quota: "This site's Gemini quota is used up for now. Try again in a minute.",
  ai_busy: "Gemini is busy or slow right now. Try again in a few seconds.",
};

interface CheckItem {
  label: string;
  /** null = informational */
  ok: boolean | null;
  text: string;
}

// Google's reason codes for key problems, translated into the fix.
const KEY_FIX: Record<string, string> = {
  API_KEY_INVALID: "Google says the key isn't valid. Copy it again from Google AI Studio and paste only the key: no quotes, no spaces.",
  ACCESS_TOKEN_TYPE_UNSUPPORTED: "That isn't a valid Gemini API key. Copy it again from Google AI Studio → API keys.",
  SERVICE_DISABLED: "The Gemini API is turned off for this key's Google project. Create the key in Google AI Studio, which turns it on.",
  API_KEY_HTTP_REFERRER_BLOCKED: "The key only allows certain websites. Remove its website restriction in Google Cloud → Credentials; the site's server calls Gemini, not the browser.",
  API_KEY_IP_ADDRESS_BLOCKED: "The key only allows certain IP addresses. Remove that restriction in Google Cloud → Credentials.",
  API_KEY_SERVICE_BLOCKED: "The key isn't allowed to use the Gemini API. Allow “Generative Language API” for it in Google Cloud → Credentials.",
};

async function runSetupCheck(): Promise<CheckItem[]> {
  let res: Response;
  try {
    res = await fetch("/api/health?check=1", { cache: "no-store" });
  } catch {
    return [{ label: "Server", ok: false, text: "Couldn't reach the site's server. Check your connection." }];
  }
  if (res.status === 404) {
    return [{ label: "Live AI function", ok: false, text: "Not deployed. In Netlify the site must be imported from GitHub (Add new project → Import an existing project) so the functions get built. A drag-and-drop upload skips them." }];
  }
  if (res.status === 429) return [{ label: "Setup check", ok: null, text: "Too many checks in a minute. Wait a moment and try again." }];
  if (!res.ok) return [{ label: "Live AI function", ok: false, text: `The function crashed (HTTP ${res.status}). Open Netlify → Logs → Functions → health to see the error.` }];

  const r = (await res.json()) as HealthReport;
  const redeploy = "Then in Netlify: Deploys → Trigger deploy → Clear cache and deploy.";
  const items: CheckItem[] = [{ label: "Live AI function", ok: true, text: "Deployed." }];
  items.push(
    r.geminiKey === "set"
      ? { label: "Gemini key", ok: true, text: "Set." }
      : { label: "Gemini key", ok: false, text: `Missing. In Netlify: Site configuration → Environment variables → Add a variable named exactly GEMINI_API_KEY. ${redeploy}` },
  );
  const g = r.gemini;
  if (g?.ok) items.push({ label: "Gemini", ok: true, text: `${g.model} answered in ${g.ms} ms. The live AI should work; try Ask both again.` });
  else if (g?.kind === "key_rejected") items.push({ label: "Gemini", ok: false, text: `${KEY_FIX[g.detail] ?? `Google rejected the key (${g.detail}). Create a new key in Google AI Studio.`} ${redeploy}` });
  else if (g?.kind === "quota") items.push({ label: "Gemini", ok: false, text: "The key's free quota is used up. Per-minute limits reset within a minute, daily limits at midnight Pacific time. Turning on billing in Google AI Studio lifts them." });
  else if (g?.kind === "unavailable") items.push({ label: "Gemini", ok: false, text: `Gemini didn't answer (${g.detail}). Try again in a minute.` });
  items.push({ label: "Bot check", ok: null, text: r.turnstile === "on" ? "Turnstile is on." : "Off (optional)." });
  return items;
}

function SetupCheck() {
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [checking, setChecking] = useState(false);
  return (
    <div className="setup">
      <div className="colhead" style={{ marginBottom: 0, alignItems: "center" }}>
        <span className="small"><b>Live AI not working?</b> Check what&rsquo;s missing.</span>
        <button
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            setItems(await runSetupCheck());
            setChecking(false);
          }}
        >
          {checking ? "Checking…" : "Check setup"}
        </button>
      </div>
      {items && (
        <ul className="checks" aria-live="polite">
          {items.map((i) => (
            <li key={i.label} className={i.ok === true ? "ok" : i.ok === false ? "bad" : ""}>
              <b>{i.label}:</b> {i.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
      {!busy && (answers.naive.error || answers.foolproof.error) && <SetupCheck />}
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
