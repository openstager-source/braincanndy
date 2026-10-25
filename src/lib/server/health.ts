// Setup check for the live AI: is the function deployed, is the key set, does Gemini answer?
// Returns status words only: never the key, never Google's full error messages.
import { geminiModels, pingGemini, readGeminiKey, type PingResult } from "./gemini";
import { rateLimit } from "./guard";
import { readWebKey } from "./web";

export interface HealthReport {
  liveAi: "deployed";
  geminiKey: "set" | "missing";
  models: string[];
  turnstile: "on" | "off";
  /** Serpstack key for the "From the web" results. Only reported, never pinged: searches are scarce. */
  webSearch: "set" | "missing";
  /** Present when called with ?check=1: one tiny real request to Gemini. */
  gemini?: PingResult;
}

export async function handleHealth(req: Request, ip: string): Promise<Response> {
  const check = new URL(req.url).searchParams.get("check") === "1";
  // The live check spends a (tiny) Gemini request, so it shares the endpoint's rate limit.
  if (check && !rateLimit(ip).ok) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
  const report: HealthReport = {
    liveAi: "deployed",
    geminiKey: readGeminiKey() ? "set" : "missing",
    models: geminiModels(),
    turnstile: process.env.TURNSTILE_SECRET_KEY ? "on" : "off",
    webSearch: readWebKey() ? "set" : "missing",
  };
  if (check) report.gemini = await pingGemini();
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
