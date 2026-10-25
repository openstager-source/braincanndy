// "Ask about this place": the AI explains a review's verdict or answers a diner's question,
// grounded only in that place's scored data. Same guards as the live answer endpoint.
import { z } from "zod";
import { sandbox } from "../sandbox/instance";
import { RESTAURANTS } from "../sandbox/restaurants";
import { scorePlaces } from "../scoring/engine";
import { evidenceFor, reasonCounts } from "../search/insights";
import { GeminiError, GeminiNotConfigured, streamGemini } from "./gemini";
import { hasValidPass, passCookie, rateLimit, sameOrigin, verifyTurnstile } from "./guard";
import { placeQuestionPrompt, reviewVerdictPrompt } from "./prompts";
import type { AnswerError } from "./answer";

const Body = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("review"),
    placeId: z.string().regex(/^r\d{2}$/),
    reviewId: z.string().max(40).regex(/^[a-z0-9-]+$/),
    turnstileToken: z.string().max(2048).optional(),
  }),
  z.object({
    intent: z.literal("question"),
    placeId: z.string().regex(/^r\d{2}$/),
    question: z.string().trim().min(2).max(200),
    turnstileToken: z.string().max(2048).optional(),
  }),
]);

const json = (status: number, error: AnswerError, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function handleAsk(req: Request, ip: string): Promise<Response> {
  if (req.method !== "POST") return json(405, "bad_request", { Allow: "POST" });
  if (!sameOrigin(req)) return json(403, "forbidden");
  if (Number(req.headers.get("content-length") ?? 0) > 2048) return json(413, "too_large");

  const limited = rateLimit(ip);
  if (!limited.ok) return json(429, "rate_limited", { "Retry-After": String(limited.retryAfter) });

  let parsed;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json(413, "too_large");
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return json(400, "bad_request");
  }
  if (!parsed.success || !RESTAURANTS.some((r) => r.id === parsed.data.placeId)) return json(400, "bad_request");
  const body = parsed.data;

  const hadPass = hasValidPass(req);
  if (!hadPass && !(await verifyTurnstile(body.turnstileToken, ip))) return json(403, "bot_check");
  const cookie = hadPass ? null : passCookie();

  // Everything the model sees is rebuilt on the server; the client only names a place and a review.
  const place = scorePlaces(sandbox, undefined, [body.placeId]).get(body.placeId)!;
  let prompt;
  if (body.intent === "review") {
    const review = place.scored.find((s) => s.review.id === body.reviewId);
    if (!review) return json(404, "no_match");
    prompt = reviewVerdictPrompt(place, review, evidenceFor(review));
  } else {
    prompt = placeQuestionPrompt(place, body.question, reasonCounts(place));
  }

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
    if (e instanceof GeminiError && e.kind === "key_rejected") return json(502, "key_rejected");
    if (e instanceof GeminiError && e.kind === "quota") return json(503, "quota", { "Retry-After": "60" });
    return json(503, "ai_busy", { "Retry-After": "10" });
  }
}
