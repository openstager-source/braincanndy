"use client";

import { useEffect, useState } from "react";

const KEY = "foolproof.motion";

/** The brand's "motion off" switch. The choice is remembered in this browser. */
export default function MotionToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => setOff(document.documentElement.dataset.motion === "off"), []);

  const toggle = () => {
    const next = !off;
    setOff(next);
    if (next) document.documentElement.dataset.motion = "off";
    else delete document.documentElement.dataset.motion;
    try {
      localStorage.setItem(KEY, next ? "off" : "on");
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  };

  return (
    <button type="button" className="motion-toggle" aria-pressed={!off} onClick={toggle}>
      <span className="motion-dot" aria-hidden="true" />
      Motion {off ? "off" : "on"}
    </button>
  );
}
