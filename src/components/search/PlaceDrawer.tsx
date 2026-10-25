"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type RefObject } from "react";
import type { PlaceResult } from "@/lib/scoring/engine";
import { REASON_LABEL, reasonCounts } from "@/lib/search/insights";
import AskPlace from "./AskPlace";
import { CloseIcon, ShieldIcon } from "./icons";
import PlaceArt from "./PlaceArt";
import ReviewCheck from "./ReviewCheck";
import ReviewTimeline from "./ReviewTimeline";

const SHEET = "(max-width: 980px)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

interface Props {
  place: PlaceResult | null;
  ranks: { trust: number; raw: number } | null;
  live: boolean;
  now: number;
  onClose: () => void;
}

/** The evidence for one place: a side panel on wide screens, a bottom sheet on phones. */
export default function PlaceDrawer({ place, ranks, live, now, onClose }: Props) {
  const sheet = useMedia(SHEET);
  const panel = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // While the sheet slides away it keeps showing the place it had, instead of going blank.
  const [shown, setShown] = useState(place);
  if (place && place !== shown) setShown(place);
  const content = place ?? (sheet ? shown : null);
  const open = place !== null;
  const id = place?.restaurant.id;

  // Land keyboard and screen-reader users on the place they opened.
  useEffect(() => {
    if (!id) return;
    panel.current?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, [id]);

  // Escape closes. On phones the sheet is modal, so the page behind it doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    const root = document.documentElement;
    if (sheet) root.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      root.style.overflow = "";
    };
  }, [open, sheet, onClose]);

  return (
    <>
      {sheet && open && <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside
        ref={panel}
        id="place-panel"
        className={`drawer${open ? " open" : ""}${content ? " glass" : ""}`}
        role={sheet && open ? "dialog" : undefined}
        aria-modal={sheet && open ? true : undefined}
        aria-labelledby={content ? "place-title" : undefined}
        aria-label={content ? undefined : "Evidence"}
        inert={sheet && !open}
      >
        {sheet && <SheetHandle panel={panel} onClose={onClose} />}
        {content ? (
          <Detail key={content.restaurant.id} place={content} ranks={ranks} live={live} now={now} onClose={onClose} titleRef={title} />
        ) : (
          <div className="drawer-empty glass">
            <ShieldIcon className="empty-icon" />
            <h2>Pick a result to see its evidence</h2>
            <p className="muted">
              Foolproof checks who posted each review and when: bursts of posts, brand-new accounts, copy-paste wording, and instructions aimed at AI. Then it tests you: can you spot a fake?
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

/** Drag the sheet down to close it. */
function SheetHandle({ panel, onClose }: { panel: RefObject<HTMLElement | null>; onClose: () => void }) {
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = "none";
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.current.style.transform = `translateY(${d.dy}px)`;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (panel.current) {
      panel.current.style.transition = "";
      panel.current.style.transform = "";
    }
    if (d && d.dy > 90) onClose();
  };
  return <div className="sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true" />;
}

interface DetailProps {
  place: PlaceResult;
  ranks: { trust: number; raw: number } | null;
  live: boolean;
  now: number;
  onClose: () => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

function Detail({ place, ranks, live, now, onClose, titleRef }: DetailProps) {
  const r = place.restaurant;
  const reasons = reasonCounts(place);
  return (
    <div className="drawer-card">
      <PlaceArt place={r} variant="hero" />
      <div className="drawer-head">
        <div>
          <h2 id="place-title" ref={titleRef} tabIndex={-1}>{r.name}</h2>
          <p className="meta">{r.area} · ₹{r.priceForOne} for one · {r.dishes.filter((d) => d !== "cafe").join(", ")}</p>
        </div>
        <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </div>

      <div className="dial-row">
        <TrustDial value={place.trustRating} />
        <div className="stat-list">
          <span>Raw stars <b>{place.naiveRating.toFixed(1)}★</b></span>
          {ranks && <span><b>#{ranks.trust}</b> by trust · <b>#{ranks.raw}</b> by raw stars</span>}
          <span><b>{place.flagged}</b> of {place.reviewCount} reviews set aside</span>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="signal-list" aria-label="Suspicious signals found">
          {reasons.map((x) => <li key={x.kind}>{REASON_LABEL[x.kind]} <b>{x.count}</b></li>)}
        </ul>
      )}

      <section aria-labelledby="timeline-title">
        <h3 id="timeline-title" className="section-title">When reviews were posted</h3>
        <ReviewTimeline place={place} now={now} />
      </section>

      <ReviewCheck place={place} live={live} />
      <AskPlace place={place} live={live} />
    </div>
  );
}

/** Trust rating out of 5 as a ring that fills when the panel opens. */
function TrustDial({ value }: { value: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const f = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(f);
  }, [value]);
  return (
    <div className="dial">
      <svg viewBox="0 0 96 96" role="img" aria-label={`Trust rating ${value.toFixed(1)} out of 5`}>
        <circle className="track" cx="48" cy="48" r={r} />
        <circle className="value" cx="48" cy="48" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - shown / 5)} transform="rotate(-90 48 48)" />
        <text x="48" y="52" textAnchor="middle">{value.toFixed(1)}</text>
        <text className="sub" x="48" y="67" textAnchor="middle">TRUST ★</text>
      </svg>
    </div>
  );
}
