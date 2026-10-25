// Setup check for the live AI. Open /api/health?check=1 on the deployed site to see what's wrong.
import type { Config, Context } from "@netlify/functions";
import { handleHealth } from "../../src/lib/server/health";

export default (req: Request, context: Context) => handleHealth(req, context.ip);

export const config: Config = {
  path: "/api/health",
  method: "GET",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
