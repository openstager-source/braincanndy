"use client";

import { useEffect, useState } from "react";
import { afterBotCheck } from "@/lib/ai-client";
import type { ParsedQuery } from "@/lib/scoring/query";
import type { WebLink, WebResponse } from "@/lib/server/web";
import { GlobeIcon, PinIcon } from "./icons";

const MESSAGES: Record<string, string> = {
  web_key_rejected: "Web results are off: Serpstack rejected the API key. The site owner needs to check WEB_SEARCH_API_KEY in Netlify.",
  web_quota: "Web results are paused: this month’s Serpstack searches are used up.",
  web_plan: "Web results are off: the current Serpstack plan doesn’t allow this search.",
  rate_limited: "Too many searches in a minute. Web results will load on your next search.",
  bot_check: "Web results need the bot check to finish. Search again.",
  web_unavailable: "Web results didn’t load. Try the search again.",
};

// Results already fetched during this visit.
const fetched = new Map<string, WebResponse>();

const cacheKey = (q: string) => q.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const isHttp = (l: WebLink) => /^https?:\/\//i.test(l.url);

interface State {
  data?: WebResponse;
  error?: string;
  loading: boolean;
}

/**
 * Real Google results for the same search, under the sandbox ranking. They're shown as Google lists
 * them and never trust-scored: we can't see who wrote those reviews, and we never label a real business.
 */
export default function WebResults({ query, parsed, live }: { query: string; parsed: ParsedQuery; live: boolean }) {
  // Sandbox places are fictional; a web search for their names would surface unrelated real businesses.
  const skip = !live || Boolean(parsed.placeIds?.length);
  const key = cacheKey(query);
  const [state, setState] = useState<State>(() => (fetched.has(key) ? { data: fetched.get(key), loading: false } : { loading: !skip }));

  useEffect(() => {
    if (skip || fetched.has(key)) return;
    const ctrl = new AbortController();
    void (async () => {
      await afterBotCheck();
      const res = await fetch(`/api/web?q=${encodeURIComponent(key)}`, { signal: ctrl.signal }).catch(() => null);
      if (ctrl.signal.aborted) return;
      const body = (await res?.json().catch(() => null)) as (WebResponse & { error?: string }) | null;
      if (res?.ok && body?.links) {
        fetched.set(key, body);
        return setState({ data: body, loading: false });
      }
      // Not set up on this site (204), or no server at all: leave the section out instead of showing an error.
      if (!res || res.status === 204 || res.status === 404) return setState({ loading: false });
      setState({ loading: false, error: MESSAGES[body?.error ?? ""] ?? MESSAGES.web_unavailable });
    })();
    return () => ctrl.abort();
  }, [key, skip]);

  if (skip || (!state.loading && !state.data && !state.error)) return null;
  const links = state.data?.links.filter(isHttp) ?? [];
  const places = state.data?.places ?? [];

  return (
    <section className="web glass" aria-labelledby="web-title" aria-busy={state.loading}>
      <div className="web-head">
        <h2 id="web-title"><GlobeIcon />From the web</h2>
        <span className="web-tag">Google via Serpstack · not trust-checked</span>
      </div>
      {state.loading && (
        <div className="web-wait" aria-hidden="true">
          <div className="shimmer" />
          <div className="shimmer" style={{ width: "74%" }} />
          <div className="shimmer" style={{ width: "88%" }} />
        </div>
      )}
      {state.error && <p className="web-error" role="status">{state.error}</p>}
      {places.length > 0 && (
        <ul className="web-places" aria-label="Places on Google">
          {places.map((p) => (
            <li key={p.title + (p.address ?? "")}>
              <PinIcon />
              <div>
                <b>{p.title}</b>
                <span>
                  {[p.rating !== undefined && `${p.rating}★ on Google`, p.reviews !== undefined && `${p.reviews.toLocaleString("en-IN")} reviews`, p.type].filter(Boolean).join(" · ")}
                </span>
                {p.address && <span>{p.address}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <ol className="web-list">
          {links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                <span className="web-dom"><i aria-hidden="true">{l.domain[0]?.toUpperCase()}</i>{l.domain}</span>
                <b>{l.title}</b>
              </a>
              {l.snippet && <p>{l.snippet}</p>}
            </li>
          ))}
        </ol>
      )}
      {state.data && links.length === 0 && places.length === 0 && <p className="muted">No web results for this search.</p>}
      <p className="web-note">Real places and pages, as Google lists them. Foolproof hasn’t checked their reviews; it only scores the fictional sandbox above. Your search text goes to Serpstack to fetch these.</p>
    </section>
  );
}
