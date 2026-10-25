import { z } from "zod";
import { AttackSchema } from "@/lib/sandbox/attack-schema";
import { generateSandbox } from "@/lib/sandbox/generate";
import { runQuery } from "@/lib/scoring/engine";
import { GeminiNotConfigured, streamGemini } from "@/lib/server/gemini";
import { clientIp, rateLimit, sameOrigin, verifyTurnstile } from "@/lib/server/guard";
import { foolproofPrompt, naivePrompt } from "@/lib/server/prompts";

export const runtime = "nodejs";

const Body = z.object({
  mode: z.enum(["naive", "foolproof"]),
  query: z.string().trim().min(3).max(120),
  attack: AttackSchema,
  turnstileToken: z.string().max(2048).optional(),
});

const sandbox = generateSandbox();
const json = (status: number, error: string, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, "Forbidden");
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return json(413, "Too large");

  const ip = clientIp(req);
  const limited = rateLimit(ip);
  if (!limited.ok) return json(429, "Too many requests", { "Retry-After": String(limited.retryAfter) });

  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(await req.text()));
  } catch {
    return json(400, "Invalid JSON");
  }
  if (!parsed.success) return json(400, "Invalid request");
  const { mode, query, attack, turnstileToken } = parsed.data;

  if (!(await verifyTurnstile(turnstileToken, ip))) return json(403, "Bot check failed");

  // Fake reviews are rebuilt here from validated parameters; the client never sends review text.
  const result = runQuery(sandbox, query, attack);
  const places = mode === "naive" ? result.naive : result.foolproof;
  if (places.length === 0) return json(404, "No matching restaurants in the sandbox");

  const prompt = mode === "naive" ? naivePrompt(query, places) : foolproofPrompt(query, places);
  try {
    const stream = await streamGemini({ ...prompt, signal: req.signal });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof GeminiNotConfigured) return json(503, "Live AI is not configured");
    return json(502, "AI service unavailable");
  }
}
