// Netlify Function behind "Ask about this place" and "Explain with AI" in the evidence panel.
import type { Config, Context } from "@netlify/functions";
import { handleAsk } from "../../src/lib/server/ask";

export default (req: Request, context: Context) => handleAsk(req, context.ip);

export const config: Config = {
  path: "/api/ask",
  method: "POST",
  // Platform-enforced across instances. Each question or explanation is one request.
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
