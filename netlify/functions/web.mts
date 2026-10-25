// "From the web" results on the search page: Google results via Serpstack, cached on Netlify's CDN.
import type { Config, Context } from "@netlify/functions";
import { handleWeb } from "../../src/lib/server/web";

export default (req: Request, context: Context) => handleWeb(req, context.ip);

export const config: Config = {
  path: "/api/web",
  method: "GET",
  // Cached responses never reach the function; this limits the misses that spend Serpstack searches.
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
