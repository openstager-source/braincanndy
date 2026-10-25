// The live AI endpoint, framework-free so it runs as a Netlify Function and in tests.
import { z } from "zod";
import { AttackSchema } from "../sandbox/attack-schema";
import { generateSandbox } from "../sandbox/generate";
import { runQuery } from "../scoring/engine";
import { GeminiKeyRejected, GeminiNotConfigured, streamGemini } from "./gemini";
import { hasValidPass, passCookie, rateLimit, sameOrigin, verifyTurnstile } from "./guard";
import { foolproofPrompt, naivePrompt } from "./prompts";

const Body = z.object({
  mode: z.enum(["naive", "foolproof"]),
  query: z.string().trim().min(3).max(120),
  attack: AttackSchema,
  turnstileToken: z.string().max(2048).optional(),
});

/** Machine-readable reasons, so the page can tell the visitor what to do. */
export type AnswerError = "forbidden" | "too_large" | "rate_limited" | "bad_request" | "bot_check" | "no_match" | "not_configured" | "key_rejected" | "ai_busy";

const sandbox = generateSandbox();
const json = (status: number, error: AnswerError, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function handleAnswer(req: Request, ip: string): Promise<Response> {
  if (req.method !== "POST") return json(405, "bad_request", { Allow: "POST" });
  if (!sameOrigin(req)) return json(403, "forbidden");
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return json(413, "too_large");

  const limited = rateLimit(ip);
  if (!limited.ok) return json(429, "rate_limited", { "Retry-After": String(limited.retryAfter) });

  let parsed;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json(413, "too_large");
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return json(400, "bad_request");
  }
  if (!parsed.success) return json(400, "bad_request");
  const { mode, query, attack, turnstileToken } = parsed.data;

  const hadPass = hasValidPass(req);
  if (!hadPass && !(await verifyTurnstile(turnstileToken, ip))) return json(403, "bot_check");
  const cookie = hadPass ? null : passCookie();

  // Fake reviews are rebuilt here from validated parameters; the client never sends review text.
  const result = runQuery(sandbox, query, attack);
  const places = mode === "naive" ? result.naive : result.foolproof;
  if (places.length === 0) return json(404, "no_match");

  const prompt = mode === "naive" ? naivePrompt(query, places) : foolproofPrompt(query, places);
  try {
    const { model, stream } = await streamGemini({ ...prompt, signal: req.signal });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Model": model,
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  } catch (e) {
    if (e instanceof GeminiNotConfigured) return json(503, "not_configured");
    if (e instanceof GeminiKeyRejected) return json(502, "key_rejected");
    return json(503, "ai_busy", { "Retry-After": "10" });
  }
}
