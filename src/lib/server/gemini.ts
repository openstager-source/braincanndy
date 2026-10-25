// Server-only: reads the API key from the environment. Never import this from a component.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Tried in order. Fast "lite" models first: the bigger Flash models measured 40–70s per answer,
 * which can't finish inside Netlify's 60s function limit. Override with GEMINI_MODEL="a,b,c".
 */
export const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"];

/** Give up on a model that hasn't started answering by then, and try the next one. */
const FIRST_BYTE_MS = 15_000;
/** Hard stop for the whole answer, safely under Netlify's 60s limit for synchronous functions. */
const TOTAL_MS = 45_000;

export class GeminiNotConfigured extends Error {}
export class GeminiKeyRejected extends Error {}
export class GeminiUnavailable extends Error {}

interface Part {
  text?: string;
  thought?: boolean;
}
interface Chunk {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Configured models first, then the fast defaults as a safety net. */
export function geminiModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_MODELS])];
}

/** Streams Gemini text as plain UTF-8 chunks. Falls back to the next model on overload, slowness or a retired model. */
export async function streamGemini(opts: { system: string; user: string; signal?: AbortSignal }): Promise<{ model: string; stream: ReadableStream<Uint8Array> }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiNotConfigured("GEMINI_API_KEY is not set");

  const deadline = AbortSignal.timeout(TOTAL_MS);
  const overall = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" } },
  });

  for (const model of geminiModels()) {
    if (overall.aborted) break;
    // Per-attempt controller: the first-byte timer must not keep running once the answer is streaming.
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(overall.reason);
    overall.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(new Error("first-byte timeout")), FIRST_BYTE_MS);

    let res: Response;
    try {
      res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: ctrl.signal,
      });
    } catch (e) {
      overall.removeEventListener("abort", onAbort);
      console.warn(`gemini ${model}: no response (${(e as Error).message}), trying next model`);
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (res.ok && res.body) return { model, stream: toTextStream(res.body, ctrl.signal) };

    overall.removeEventListener("abort", onAbort);
    // Log upstream details server-side only; they never reach the client.
    console.warn(`gemini ${model}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    if (res.status === 401 || res.status === 403) throw new GeminiKeyRejected(`HTTP ${res.status}`);
  }
  throw new GeminiUnavailable("all models failed or timed out");
}

const enc = new TextEncoder();

/** Turns Gemini's SSE stream into plain text, and ends with a short note instead of an error if it's cut off. */
function toTextStream(body: ReadableStream<Uint8Array>, signal: AbortSignal): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let wroteText = false;
  let enqueued = 0;

  const handle = (line: string, controller: ReadableStreamDefaultController<Uint8Array>) => {
    const send = (s: string) => {
      controller.enqueue(enc.encode(s));
      enqueued++;
    };
    if (!line.startsWith("data:")) return;
    let chunk: Chunk;
    try {
      chunk = JSON.parse(line.slice(5));
    } catch {
      return; // keep-alives and partial frames
    }
    const cand = chunk.candidates?.[0];
    for (const p of cand?.content?.parts ?? []) {
      if (p.text && !p.thought) {
        send(p.text);
        wroteText = true;
      }
    }
    if (chunk.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") {
      send("\n\n[The AI declined to answer this one.]");
    } else if (cand?.finishReason === "MAX_TOKENS") {
      send("\n\n[Answer cut at the length limit.]");
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Keep reading until something is enqueued or the stream ends. A pull that returns
        // without enqueuing is never called again, which would stall the response forever.
        const before = enqueued;
        while (enqueued === before) {
          const { done, value } = await reader.read();
          if (done) {
            if (buf) handle(buf, controller);
            if (!wroteText) controller.enqueue(enc.encode("[The AI returned an empty answer. Try again.]"));
            controller.close();
            return;
          }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) handle(line, controller);
        }
      } catch {
        const why = signal.aborted ? "the AI took too long" : "the connection to the AI dropped";
        controller.enqueue(enc.encode(`\n\n[Stopped: ${why}. Try again.]`));
        controller.close();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
