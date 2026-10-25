/**
 * Page background: drifting teal glows, two lime squiggles that draw themselves in, and matte grain.
 * Each squiggle has its own <svg> so the drift moves a whole element on the GPU; moving paths inside
 * one big SVG would repaint the full screen on the main thread every frame.
 */
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="glow g1" />
      <div className="glow g2" />
      <div className="glow g3" />
      <div className="squiggles">
        <svg className="sq sq1" viewBox="-50 100 520 140">
          <path className="squiggle" pathLength={1} d="M-40 196c62-58 110 34 172-14s96-86 160-28 104 56 166 2" />
        </svg>
        <svg className="sq sq2" viewBox="1026 660 452 112">
          <path className="squiggle s2" pathLength={1} d="M1036 742c54-48 100 28 154-10s84-68 138-20 86 40 140-4" />
        </svg>
      </div>
      <div className="grain" />
    </div>
  );
}
