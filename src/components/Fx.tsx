"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Medal } from "./icons";

export interface Toast {
  id: number;
  title: string;
  detail: string;
}

/** Achievement toasts plus a confetti burst. */
export function useFx() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState(0);
  const nextId = useRef(1);

  const celebrate = useCallback((title: string, detail: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, title, detail }]);
    setBurst((b) => b + 1);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return { toasts, burst, celebrate };
}

export function Fx({ toasts, burst }: { toasts: Toast[]; burst: number }) {
  return (
    <>
      <Confetti trigger={burst} />
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Medal />
            <div>
              <b>{t.title}</b>
              <span>{t.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Confetti({ trigger }: { trigger: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!trigger || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Reallocating the canvas is costly; only do it when the window size changed.
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(document.documentElement);
    const colors = ["--saffron", "--mint", "--chili"].map((v) => css.getPropertyValue(v).trim() || "#e19a0b");
    // Grouped by colour so fillStyle changes three times per frame, not once per piece.
    const groups = colors.map((color) => ({
      color,
      bits: Array.from({ length: 22 }, () => ({
        x: w / 2 + (Math.random() - 0.5) * 120,
        y: h * 0.4,
        vx: (Math.random() - 0.5) * 14,
        vy: -4 - Math.random() * 11,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
      })),
    }));

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    let frame = 0;
    let raf = 0;
    const tick = () => {
      clear();
      let onScreen = 0;
      for (const g of groups) {
        ctx.fillStyle = g.color;
        for (const b of g.bits) {
          b.vy += 0.32;
          b.vx *= 0.99;
          b.x += b.vx;
          b.y += b.vy;
          b.rot += b.spin;
          if (b.y > h + 20) continue;
          onScreen++;
          // One transform per piece instead of save/translate/rotate/restore, which is far cheaper.
          const c = Math.cos(b.rot) * dpr;
          const s = Math.sin(b.rot) * dpr;
          ctx.setTransform(c, s, -s, c, b.x * dpr, b.y * dpr);
          ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        }
      }
      if (onScreen > 0 && ++frame < 100) raf = requestAnimationFrame(tick);
      else clear();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clear();
    };
  }, [trigger]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
