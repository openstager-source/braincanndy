"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { normalizeQuery, parseQuery } from "@/lib/scoring/query";
import type { RankMode } from "@/lib/search/insights";
import { ArrowIcon, ChevronIcon, MicIcon, PlusIcon, ShieldIcon, StarIcon } from "./icons";

export const MODES: { id: RankMode; title: string; detail: string }[] = [
  { id: "trust", title: "Trust ranking", detail: "Suspicious reviews count for less, so bought stars can’t buy the top spot." },
  { id: "raw", title: "Raw stars", detail: "Every review counts the same. This is what a naive AI ranks by." },
];

// Filters write plain words into the query, so the box always shows exactly what runs.
const DISHES = ["cafe", "biryani", "dosa", "chai"];
const AREAS = ["Gachibowli", "Kondapur", "Hitech City", "Madhapur"];
const BUDGETS = [200, 400, 600];

interface Parts {
  dish?: string;
  area?: string;
  near: boolean;
  maxPrice?: number;
}

function partsOf(q: string): Parts {
  const p = parseQuery(q);
  return { dish: p.dish, area: p.area, near: /\b(near|around|close to|nearby)\b/.test(normalizeQuery(q)), maxPrice: p.maxPrice };
}

const compose = (p: Parts) =>
  [`best ${p.dish ?? "places"}`, p.area && `${p.near ? "near" : "in"} ${p.area}`, p.maxPrice && `under ₹${p.maxPrice}`].filter(Boolean).join(" ");

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  mode: RankMode;
  onMode: (m: RankMode) => void;
  variant: "hero" | "compact";
  /** The visitor is about to search: start loading the results code. */
  onIntent?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Voice search; off in the static preview, whose frame refuses the microphone. */
  voice?: boolean;
}

export default function SearchBox({ value, onChange, onSubmit, mode, onMode, variant, onIntent, inputRef, voice = true }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const speech = useSpeech((text, final) => {
    onChange(text);
    if (final) onSubmit(text);
  });
  const parts = partsOf(value);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  // On the results page a filter re-runs the search at once; on the home page it only edits the query.
  const toggle = <K extends "dish" | "area" | "maxPrice">(key: K, v: Parts[K]) => {
    const next = compose({ ...parts, [key]: parts[key] === v ? undefined : v });
    onChange(next);
    if (variant === "compact") onSubmit(next);
  };

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button key={label} type="button" className="chip-btn" aria-pressed={on} onClick={onClick}>{label}</button>
  );

  return (
    <div className={`sb-wrap ${variant}`}>
      <form className="searchbox" role="search" onSubmit={submit} onPointerEnter={onIntent}>
        <button type="button" className="sb-btn" aria-label="Filters" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen((o) => !o)}>
          <PlusIcon />
        </button>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onIntent}
          placeholder="Ask Foolproof"
          aria-label="Search places to eat"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          spellCheck={false}
        />
        <ModeMenu mode={mode} onMode={onMode} />
        {/* Holds its place (invisible) until support is known, so the bar doesn't shift when it appears. */}
        {voice && speech.supported !== false && (
          <button
            type="button"
            className={`sb-btn sb-mic${speech.supported === null ? " pending" : ""}${speech.listening ? " listening" : ""}`}
            aria-label={speech.listening ? "Stop listening" : "Search by voice"}
            aria-pressed={speech.listening}
            disabled={speech.supported === null}
            onClick={speech.toggle}
          >
            <MicIcon />
          </button>
        )}
        <button type="submit" className="sb-btn sb-go" aria-label="Search">
          <ArrowIcon />
        </button>
      </form>
      {filtersOpen && (
        <div className="filters" id={filtersId} role="group" aria-label="Filters">
          <span className="label">What</span>
          {DISHES.map((d) => chip(d, parts.dish === d, () => toggle("dish", d)))}
          <span className="label">Where</span>
          {AREAS.map((a) => chip(a, parts.area === a, () => toggle("area", a)))}
          <span className="label">Budget</span>
          {BUDGETS.map((b) => chip(`under ₹${b}`, parts.maxPrice === b, () => toggle("maxPrice", b)))}
        </div>
      )}
      {speech.note && <p className="sb-note" role="status">{speech.note}</p>}
    </div>
  );
}

function ModeMenu({ mode, onMode }: { mode: RankMode; onMode: (m: RankMode) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (m: RankMode) => {
    onMode(m);
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if ((e.key === "Enter" || e.key === " ") && at >= 0) {
      e.preventDefault();
      choose(MODES[at]!.id);
    }
  };

  return (
    <div className="mode" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="mode-btn"
        aria-label={`Ranking: ${current.title}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {mode === "trust" ? <ShieldIcon /> : <StarIcon />}
        <span className="mode-word">{current.title}</span>
        <ChevronIcon className="chev" />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label="Ranking" className="mode-list" onKeyDown={onKey}>
          {MODES.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === mode} tabIndex={-1} onClick={() => choose(m.id)}>
              <span className="tick" aria-hidden="true">{m.id === mode ? "✓" : ""}</span>
              <div>
                <b>{m.title}</b>
                <small>{m.detail}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Web Speech API, typed just enough for what we use. Chrome and Safari prefix it.
interface SpeechEvent {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognizer {
  lang: string;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognizerClass = new () => Recognizer;

const speechApi = () => {
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser’s site settings to search by voice.",
  "service-not-allowed": "Voice search isn’t allowed in this browser.",
  "audio-capture": "No microphone found.",
  "no-speech": "Didn’t catch that. Tap the mic and try again.",
  network: "Voice search needs an internet connection.",
};

/** Voice input. `supported` is null until checked, then false where the browser has no speech recognition. */
function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<Recognizer | null>(null);
  const latest = useRef(onText);
  useEffect(() => {
    latest.current = onText;
  });
  useEffect(() => {
    setSupported(Boolean(speechApi()));
    return () => rec.current?.abort();
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const toggle = () => {
    if (rec.current) {
      rec.current.abort();
      return;
    }
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = "en-IN";
    r.interimResults = true;
    r.onresult = (e) => {
      const parts = Array.from(e.results);
      const text = parts.map((p) => p[0].transcript).join("").trim();
      if (text) latest.current(text.slice(0, 120), parts.at(-1)?.isFinal ?? false);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setNote(SPEECH_ERRORS[e.error] ?? "Voice search stopped. Try again.");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setNote("");
    setListening(true);
    r.start();
  };

  return { supported, listening, note, toggle };
}
