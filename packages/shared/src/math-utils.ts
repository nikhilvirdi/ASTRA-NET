/** Generic numeric helpers used across engines. Not formula-specific themselves. */

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Positive-result modulo (JS `%` can return negative for negative inputs). */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * Bisection root-finder for a monotonic increasing function on a bracketed
 * interval. FORMULAS.md §6 mandates bisection (not Newton) for the DBM
 * r(t) = 1 AU solve, since r is monotonic in t and this guarantees
 * convergence without derivative fragility.
 */
export function bisectionSolve(
  f: (x: number) => number,
  target: number,
  lo: number,
  hiInitial: number,
  maxIterations = 100,
): number {
  let hi = hiInitial;
  while (f(hi) < target) {
    hi *= 2;
  }

  let low = lo;
  let high = hi;
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    if (f(mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
