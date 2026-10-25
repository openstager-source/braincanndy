// Netlify Function behind the "Run live with Gemini" button. Everything else on the site is static.
import type { Config, Context } from "@netlify/functions";
import { handleAnswer } from "../../src/lib/server/answer";

export default (req: Request, context: Context) => handleAnswer(req, context.ip);

export const config: Config = {
  path: "/api/answer",
  method: "POST",
  // Enforced by Netlify's edge across all function instances, unlike the in-memory limit.
  // Each click asks both AIs, so this is 5 clicks per minute per visitor.
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
