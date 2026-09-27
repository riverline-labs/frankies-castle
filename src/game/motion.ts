// How a reel strip moves. No three.js imports.
// Group Y decreases during a spin, so the cards travel downward.
// Card index increases with local +Y: higher indices sit above the window
// and enter from the top. The last three cards are bottom, middle, top.

export interface ReelPath {
  startY: number;
  endY: number;
}

export function easeOutReel(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3.4);
}

export function reelPath(centerY: number, stripLength: number, cell: number): ReelPath {
  const n = stripLength;
  return {
    startY: centerY - cell,
    endY: centerY - (n - 2) * cell,
  };
}

/** t is 0 at the start of this reel's motion and 1 when it has settled. */
export function sampleReelY(path: ReelPath, t: number, cell: number, tick: boolean): number {
  const { startY, endY } = path;
  if (!tick) return startY + (endY - startY) * easeOutReel(t);
  const overshoot = endY - cell * 0.42;
  if (t < 0.84) return startY + (overshoot - startY) * easeOutReel(t / 0.84);
  const u = (t - 0.84) / 0.16;
  return overshoot + (endY - overshoot) * easeOutReel(u);
}

export function reelTiming(reelIndex: number): { delay: number; duration: number } {
  return {
    delay: reelIndex * 0.05,
    duration: 1.32 + reelIndex * 0.24,
  };
}

export function spinTotalMs(): number {
  const last = reelTiming(4);
  return Math.ceil((last.delay + last.duration) * 1000) + 70;
}

export function idleStrip<T>(result: readonly T[]): T[] {
  return [result[2], result[1], result[0]];
}

export function buildStrip<T>(
  previous: readonly T[],
  result: readonly T[],
  extra: number,
  filler: () => T,
): T[] {
  const lead = [previous[2], previous[1], previous[0]];
  const mid = Array.from({ length: extra }, filler);
  return [...lead, ...mid, result[2], result[1], result[0]];
}
