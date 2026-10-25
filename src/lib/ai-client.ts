// Browser-side helpers for the live AI endpoints: error wording, the optional bot check, and streaming.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const AI_MESSAGES: Record<string, string> = {
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

export async function aiErrorFor(res: Response): Promise<string> {
  const code = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  if (code && AI_MESSAGES[code]) return AI_MESSAGES[code]!;
  if (res.status === 429) return AI_MESSAGES.rate_limited!;
  if (res.status === 404 || res.status === 405) return "Live AI isn't available on this copy of the site. It runs on the Netlify deployment.";
  return `Something went wrong (HTTP ${res.status}). Try again.`;
}

/** AI text is rendered as plain text (never HTML), so drop stray Markdown markers. */
export const plainText = (s: string) => s.replace(/\*\*|__/g, "").replace(/^#{1,6}\s+/gm, "");

export interface StreamResult {
  ok: boolean;
  model?: string;
  error?: string;
}

/** Response on success, a message on failure, null when aborted. */
async function open(url: string, body: object, signal?: AbortSignal): Promise<Response | string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    return res.ok && res.body ? res : await aiErrorFor(res);
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : "Couldn't reach the server. Check your connection and try again.";
  }
}

// Turnstile tokens are single-use. A passed check earns a short-lived pass cookie from the server, so
// only the first request needs a token; requests that start meanwhile wait for that pass.
let passUntil = 0;
let gate: Promise<void> | null = null;

/** Shows the Turnstile widget in a small floating card until it produces a token. */
function turnstileToken(signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const box = document.createElement("div");
    box.className = "bot-check";
    box.setAttribute("role", "status");
    box.textContent = "Checking you’re human…";
    const slot = document.createElement("div");
    box.append(slot);
    document.body.append(box);
    const finish = (settle: () => void) => {
      box.remove();
      settle();
    };
    const fail = () => finish(() => reject(new Error("turnstile")));
    const render = () => {
      if (!window.turnstile) return fail();
      window.turnstile.render(slot, { sitekey: SITE_KEY!, callback: (t) => finish(() => resolve(t)), "error-callback": fail });
    };
    signal?.addEventListener("abort", () => finish(() => reject(new DOMException("Aborted", "AbortError"))), { once: true });
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    s.onerror = fail;
    document.head.append(s);
  });
}

async function openChecked(url: string, body: object, signal?: AbortSignal): Promise<Response | string | null> {
  if (!SITE_KEY) return open(url, body, signal);
  while (gate) await gate;
  if (Date.now() < passUntil) {
    const res = await open(url, body, signal);
    if (res === AI_MESSAGES.bot_check) passUntil = 0;
    return res;
  }
  let release = () => {};
  gate = new Promise<void>((r) => (release = r));
  try {
    const res = await open(url, { ...body, turnstileToken: await turnstileToken(signal) }, signal);
    if (res instanceof Response) passUntil = Date.now() + 9 * 60_000;
    return res;
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : "The bot check didn't load. Reload the page and try again.";
  } finally {
    gate = null;
    release();
  }
}

/** Waits while a bot check is in progress, so a plain GET to /api can use the pass it earns. */
export async function afterBotCheck(): Promise<void> {
  while (gate) await gate;
}

/** POSTs JSON and feeds the streamed text to onText. Never throws; errors come back as a message. */
export async function streamAi(url: string, body: object, onText: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResult> {
  const res = await openChecked(url, body, signal);
  if (res === null) return { ok: false };
  if (typeof res === "string") return { ok: false, error: res };
  const model = res.headers.get("X-Model") ?? undefined;
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onText(dec.decode(value, { stream: true }));
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") return { ok: false, model, error: "The answer was interrupted. Try again." };
  }
  return { ok: true, model };
}
