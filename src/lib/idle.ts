/**
 * Runs `step` repeatedly in idle time, at most ~8ms per slice, until it returns true.
 * Keeps heavy background work from delaying taps and clicks. Returns a cancel function.
 */
export function runWhenIdle(step: () => boolean, onDone?: () => void): () => void {
  let cancelled = false;
  let handle: number | undefined;
  const hasIdle = typeof requestIdleCallback === "function";
  const schedule = () => {
    handle = hasIdle ? requestIdleCallback(slice) : (setTimeout(slice, 16) as unknown as number);
  };
  const slice = () => {
    if (cancelled) return;
    const stop = performance.now() + 8;
    while (performance.now() < stop) {
      if (step()) {
        onDone?.();
        return;
      }
    }
    schedule();
  };
  schedule();
  return () => {
    cancelled = true;
    if (handle === undefined) return;
    if (hasIdle) cancelIdleCallback(handle);
    else clearTimeout(handle);
  };
}
