// Server-only request guards for the live AI endpoint.
import { createHmac, timingSafeEqual } from "node:crypto";

// Second line of defence behind Netlify's platform rate limit (see netlify/functions/answer.mts).
// In-memory, so it only holds within one warm function instance.
const PER_IP = { limit: 6, windowMs: 60_000 };
const PER_INSTANCE_DAILY = 500;

const hits = new Map<string, number[]>();
let day = { start: Date.now(), count: 0 };

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  if (now - day.start > 86_400_000) day = { start: now, count: 0 };
  if (day.count >= PER_INSTANCE_DAILY) return { ok: false, retryAfter: 3600 };

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
  if (!origin) return false;
  try {
    const o = new URL(origin).host;
    const hosts = [new URL(req.url).host, req.headers.get("x-forwarded-host"), req.headers.get("host")];
    return hosts.some((h) => h && h === o);
  } catch {
    return false;
  }
}

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

// After one passed Turnstile check, a signed cookie lets the same browser skip it for a few
// minutes. Turnstile tokens are single-use, and each click sends two requests.
const PASS_COOKIE = "fp_pass";
const PASS_TTL_S = 600;

const sign = (exp: string, secret: string) => createHmac("sha256", secret).update(`fp-pass:${exp}`).digest("base64url");

export function passCookie(now = Date.now()): string | null {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return null;
  const exp = String(Math.floor(now / 1000) + PASS_TTL_S);
  return `${PASS_COOKIE}=${exp}.${sign(exp, secret)}; Max-Age=${PASS_TTL_S}; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}

export function hasValidPass(req: Request, now = Date.now()): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${PASS_COOKIE}=`))?.slice(PASS_COOKIE.length + 1);
  const [exp, sig] = raw?.split(".") ?? [];
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  const want = Buffer.from(sign(exp, secret));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Optional bot check. Off unless TURNSTILE_SECRET_KEY is set; when on, it fails closed. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("turnstile verify failed", e);
    return false;
  }
}
