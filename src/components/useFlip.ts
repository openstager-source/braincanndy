import { useLayoutEffect, useRef, type RefObject } from "react";
import { motionAllowed } from "@/lib/motion";

/** Animates list items (marked with data-key) sliding to their new positions when the order changes. */
export function useFlip(ref: RefObject<HTMLElement | null>, order: string) {
  const prev = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animate = motionAllowed();
    const next = new Map<string, number>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const key = child.dataset.key;
      if (!key) continue;
      next.set(key, child.offsetTop); // relative to the list, so page scroll doesn't matter
      const old = prev.current.get(key);
      if (animate && old !== undefined && Math.abs(old - child.offsetTop) > 1 && typeof child.animate === "function") {
        child.animate([{ transform: `translateY(${old - child.offsetTop}px)` }, { transform: "translateY(0)" }], { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    }
    prev.current = next;
  }, [ref, order]);
}
