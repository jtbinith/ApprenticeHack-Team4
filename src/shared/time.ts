/**
 * Milliseconds → `MM:SS`, or `H:MM:SS` from an hour up. Pass `roundUp` for
 * countdowns (00:00 only at the very end); stopwatches round down.
 */
export function formatClock(ms: number, roundUp = true): string {
  const seconds = Math.max(0, ms / 1000);
  const total = roundUp ? Math.ceil(seconds) : Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
