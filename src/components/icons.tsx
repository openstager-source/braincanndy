// Small inline icons. Colours come from CSS tokens so they work in both themes.

export function BrandMark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="13.5" cy="13.5" r="9" fill="none" stroke="var(--ink)" strokeWidth="3" />
      <path d="M20.5 20.5 28 28" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="m13.5 8.6 1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="var(--saffron)" />
    </svg>
  );
}

export function Medal({ className = "medal" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 34" aria-hidden="true">
      <path d="M10 2h5l3 9h-5zM24 2h-5l-3 9h5z" fill="var(--chili)" />
      <circle cx="17" cy="21" r="11" fill="var(--saffron)" />
      <circle cx="17" cy="21" r="7.5" fill="none" stroke="#10201a" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="m17 15.8 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#10201a" fillOpacity="0.55" />
    </svg>
  );
}

export function StatusIcon({ state }: { state: "done" | "next" | "todo" | "locked" }) {
  if (state === "done") {
    return (
      <svg className="icon" viewBox="0 0 26 26" aria-label="Done">
        <circle cx="13" cy="13" r="12" fill="var(--mint)" />
        <path d="m7.5 13.5 3.6 3.6 7.4-7.6" fill="none" stroke="var(--on-strong)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === "locked") {
    return (
      <svg className="icon" viewBox="0 0 26 26" aria-label="Not available here">
        <circle cx="13" cy="13" r="12" fill="var(--surface-2)" />
        <rect x="8.5" y="12" width="9" height="7" rx="1.5" fill="var(--muted)" />
        <path d="M10.3 12V10a2.7 2.7 0 0 1 5.4 0v2" fill="none" stroke="var(--muted)" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg className="icon" viewBox="0 0 26 26" aria-label={state === "next" ? "Up next" : "To do"}>
      <circle cx="13" cy="13" r="11" fill="none" stroke={state === "next" ? "var(--saffron)" : "var(--line)"} strokeWidth="2.5" strokeDasharray={state === "next" ? "4 3" : undefined} />
    </svg>
  );
}
