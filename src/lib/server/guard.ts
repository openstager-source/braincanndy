import "server-only";

// In-memory limits work per server instance. On Vercel, swap for Upstash/Vercel KV
// so limits hold across instances; Turnstile still blocks bots either way.
const PER_IP = { limit: 6, windowMs: 60_000 };
const GLOBAL_DAILY = 1_000;

const hits = new Map<string, number[]>();
let day = { start: Date.now(), count: 0 };

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  if (now - day.start > 86_400_000) day = { start: now, count: 0 };
  if (day.count >= GLOBAL_DAILY) return { ok: false, retryAfter: 3600 };

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < PER_IP.windowMs);
  if (recent.length >= PER_IP.limit) {
    return { ok: false, retryAfter: Math.ceil((PER_IP.windowMs - (now - recent[0]!)) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  day.count++;
  if (hits.size > 10_000) hits.clear(); // bound memory under a flood
  return { ok: true };
}

/** Rejects cross-site POSTs so other sites can't spend our credits through a visitor's browser. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production"; // fail closed in production
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("turnstile verify failed", e);
    return false; // fail closed
  }
}
