"use client";

import { useState } from "react";
import type { HealthReport } from "@/lib/server/health";

interface CheckItem {
  label: string;
  /** null = informational */
  ok: boolean | null;
  text: string;
}

// Google's reason codes for key problems, translated into the fix.
const KEY_FIX: Record<string, string> = {
  API_KEY_INVALID: "Google says the key isn't valid. Copy it again from Google AI Studio and paste only the key: no quotes, no spaces.",
  ACCESS_TOKEN_TYPE_UNSUPPORTED: "That isn't a valid Gemini API key. Copy it again from Google AI Studio → API keys.",
  SERVICE_DISABLED: "The Gemini API is turned off for this key's Google project. Create the key in Google AI Studio, which turns it on.",
  API_KEY_HTTP_REFERRER_BLOCKED: "The key only allows certain websites. Remove its website restriction in Google Cloud → Credentials; the site's server calls Gemini, not the browser.",
  API_KEY_IP_ADDRESS_BLOCKED: "The key only allows certain IP addresses. Remove that restriction in Google Cloud → Credentials.",
  API_KEY_SERVICE_BLOCKED: "The key isn't allowed to use the Gemini API. Allow “Generative Language API” for it in Google Cloud → Credentials.",
};

async function runSetupCheck(): Promise<CheckItem[]> {
  let res: Response;
  try {
    res = await fetch("/api/health?check=1", { cache: "no-store" });
  } catch {
    return [{ label: "Server", ok: false, text: "Couldn't reach the site's server. Check your connection." }];
  }
  if (res.status === 404) {
    return [{ label: "Live AI function", ok: false, text: "Not deployed. In Netlify the site must be imported from GitHub (Add new project → Import an existing project) so the functions get built. A drag-and-drop upload skips them." }];
  }
  if (res.status === 429) return [{ label: "Setup check", ok: null, text: "Too many checks in a minute. Wait a moment and try again." }];
  if (!res.ok) return [{ label: "Live AI function", ok: false, text: `The function crashed (HTTP ${res.status}). Open Netlify → Logs → Functions → health to see the error.` }];

  const r = (await res.json()) as HealthReport;
  const redeploy = "Then in Netlify: Deploys → Trigger deploy → Clear cache and deploy.";
  const items: CheckItem[] = [{ label: "Live AI function", ok: true, text: "Deployed." }];
  items.push(
    r.geminiKey === "set"
      ? { label: "Gemini key", ok: true, text: "Set." }
      : { label: "Gemini key", ok: false, text: `Missing. In Netlify: Site configuration → Environment variables → Add a variable named exactly GEMINI_API_KEY. ${redeploy}` },
  );
  const g = r.gemini;
  if (g?.ok) items.push({ label: "Gemini", ok: true, text: `${g.model} answered in ${g.ms} ms. The live AI should work; try Ask both again.` });
  else if (g?.kind === "key_rejected") items.push({ label: "Gemini", ok: false, text: `${KEY_FIX[g.detail] ?? `Google rejected the key (${g.detail}). Create a new key in Google AI Studio.`} ${redeploy}` });
  else if (g?.kind === "quota") items.push({ label: "Gemini", ok: false, text: "The key's free quota is used up. Per-minute limits reset within a minute, daily limits at midnight Pacific time. Turning on billing in Google AI Studio lifts them." });
  else if (g?.kind === "unavailable") items.push({ label: "Gemini", ok: false, text: `Gemini didn't answer (${g.detail}). Try again in a minute.` });
  items.push({ label: "Bot check", ok: null, text: r.turnstile === "on" ? "Turnstile is on." : "Off (optional)." });
  items.push(
    r.webSearch === "set"
      ? { label: "Web results", ok: true, text: "Serpstack key set." }
      : { label: "Web results", ok: null, text: "Off (optional). Add WEB_SEARCH_API_KEY in Netlify to show Google results via Serpstack." },
  );
  return items;
}

export default function SetupCheck() {
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [checking, setChecking] = useState(false);
  return (
    <div className="setup">
      <div className="colhead" style={{ marginBottom: 0, alignItems: "center" }}>
        <span className="small"><b>Live AI not working?</b> Check what&rsquo;s missing.</span>
        <button
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            setItems(await runSetupCheck());
            setChecking(false);
          }}
        >
          {checking ? "Checking…" : "Check setup"}
        </button>
      </div>
      {items && (
        <ul className="checks" aria-live="polite">
          {items.map((i) => (
            <li key={i.label} className={i.ok === true ? "ok" : i.ok === false ? "bad" : ""}>
              <b>{i.label}:</b> {i.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
