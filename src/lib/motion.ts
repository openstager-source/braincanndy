/** True when the visitor hasn't turned motion off on this site or in their OS settings. */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.motion !== "off" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
