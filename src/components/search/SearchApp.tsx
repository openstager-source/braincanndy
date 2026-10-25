"use client";

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { motionAllowed } from "@/lib/motion";
import type { RankMode } from "@/lib/search/insights";
import MotionToggle from "../MotionToggle";
import Aurora from "./Aurora";
import { ArrowIcon, BowlIcon, CupIcon, ShieldIcon, TrendDownIcon } from "./icons";
import SearchBox from "./SearchBox";
import "./search.css";

// The sandbox, scoring engine and result views load on the first search (or as soon as the visitor
// heads for the search box), so the home screen ships almost no JavaScript.
const loadResults = () => import("./ResultsView");
const ResultsView = lazy(loadResults);
const prefetch = () => void loadResults();

const SUGGESTIONS = [
  { q: "Best cafe in Gachibowli", Icon: CupIcon },
  { q: "Biryani near Gachibowli under ₹400", Icon: BowlIcon },
  { q: "Is Cloud Nine Café legit?", Icon: ShieldIcon },
  { q: "Why is Velvet Bean rated so low?", Icon: TrendDownIcon },
];

const clean = (q: string) => q.replace(/\s+/g, " ").trim().slice(0, 120);
/** URL updates are a convenience (shareable links, Back): some embedding frames refuse them. */
const remember = (url: string, replace = false) => {
  try {
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  } catch {
    // The search still works; only the address doesn't follow.
  }
};
const urlFor = (q: string, mode: RankMode) => `?q=${encodeURIComponent(q)}${mode === "raw" ? "&rank=raw" : ""}`;

function readUrl() {
  const p = new URLSearchParams(location.search);
  return { query: clean(p.get("q") ?? "") || null, mode: (p.get("rank") === "raw" ? "raw" : "trust") as RankMode };
}

/** Applies a state change inside a view transition, where the browser supports it and motion is on. */
function transition(update: () => void) {
  if (!motionAllowed() || typeof document.startViewTransition !== "function") return update();
  document.startViewTransition(() => flushSync(update));
}

export interface BrandFiles {
  b: string;
  logo: string;
}
const BRAND: BrandFiles = { b: "/brand/braincanndy-b-ink.svg", logo: "/brand/braincanndy-logo-on-dark.svg" };

/** `live` is false for the static preview, which has no server for the AI or web results. */
export default function SearchApp({ live = true, brand = BRAND }: { live?: boolean; brand?: BrandFiles }) {
  const [query, setQuery] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<RankMode>("trust");
  const input = useRef<HTMLInputElement>(null);

  // Before the first paint: open a shared link (?q=) straight on its results, then follow back/forward.
  useLayoutEffect(() => {
    const apply = () => {
      const s = readUrl();
      setQuery(s.query);
      setDraft(s.query ?? "");
      setMode(s.mode);
      if (s.query) prefetch();
    };
    apply();
    delete document.documentElement.dataset.boot;
    const onPop = () => transition(apply);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // "/" jumps to the search box, as on most search engines.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      input.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(
    (raw: string) => {
      const q = clean(raw);
      if (!q) return input.current?.focus();
      prefetch();
      if (q !== query) remember(urlFor(q, mode));
      transition(() => {
        setQuery(q);
        setDraft(q);
        window.scrollTo(0, 0);
      });
    },
    [mode, query],
  );

  const changeMode = useCallback(
    (m: RankMode) => {
      setMode(m);
      if (query) remember(urlFor(query, m), true);
    },
    [query],
  );

  const goHome = (e: MouseEvent) => {
    e.preventDefault();
    if (query === null) return;
    remember(location.pathname);
    transition(() => {
      setQuery(null);
      setDraft("");
    });
  };

  const box = (variant: "hero" | "compact") => (
    <SearchBox variant={variant} value={draft} onChange={setDraft} onSubmit={search} mode={mode} onMode={changeMode} onIntent={prefetch} inputRef={input} voice={live} />
  );

  return (
    <div className="app" data-view={query ? "results" : "home"}>
      <Aurora />
      <div className="app-inner">
        <header className="topbar">
          <a className="brandlink" href="/" onClick={goHome} aria-label="Foolproof by braincanndy: home">
            <span className="b"><img src={brand.b} alt="" width={18} height={18} /></span>
            <span className="name">Foolproof</span>
            <span className="by">by <img src={brand.logo} alt="" width={98} height={18} /></span>
          </a>
          {live && <a className="navlink" href="/lab">Try to fool it <ArrowIcon /></a>}
        </header>

        <main className="app-main">
          {query === null ? (
            <section className="home" aria-labelledby="home-title">
              <p className="home-kicker"><span className="live-dot" aria-hidden="true" />Trust-ranked search · Hyderabad sandbox</p>
              <h1 id="home-title" className="home-title">Where should we <em>eat</em>?</h1>
              {box("hero")}
              <ul className="suggest" aria-label="Try a search">
                {SUGGESTIONS.map(({ q, Icon }) => (
                  <li key={q}>
                    <button type="button" onClick={() => search(q)} onPointerEnter={prefetch} onFocus={prefetch}>
                      <Icon />
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="home-note">Ranks places by how trustworthy their reviews look, so fake stars can’t buy the top spot. Every place and review here is fictional.</p>
            </section>
          ) : (
            <>
              <div className="results-top">{box("compact")}</div>
              <Suspense fallback={<ResultsSkeleton />}>
                <ResultsView key={query} query={query} mode={mode} onMode={changeMode} onSearch={search} live={live} />
              </Suspense>
            </>
          )}
        </main>

        <footer className="app-foot">
          <span>All places and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud.</span>
          <MotionToggle />
        </footer>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="results-grid" aria-busy="true" aria-label="Loading results">
      <div className="results-main">
        <div className="overview glass">
          <div className="shimmer" />
          <div className="shimmer" style={{ width: "82%" }} />
          <div className="shimmer" style={{ width: "58%" }} />
        </div>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton-card glass" />)}
      </div>
    </div>
  );
}
