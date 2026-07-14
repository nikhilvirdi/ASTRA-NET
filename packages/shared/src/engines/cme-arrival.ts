import { AU_KM, R_SUN_KM } from '../constants';
import { bisectionSolve } from '../math-utils';

/** FORMULAS.md §6 — Drag-Based Model (Vrsnak 2013) constants. */
const GAMMA_PER_KM = 0.5e-7;
const DEFAULT_AMBIENT_WIND_KM_S = 400;
const DEFAULT_R0_KM = 21.5 * R_SUN_KM;

/**
 * FORMULAS.md §6 — DBM position at time t (seconds), given v0/w in km/s.
 *
 * `sign*gamma*(v0-w)` is always >= 0 regardless of which branch of `sign`
 * is taken (if v0>w both factors are positive; if v0<w both are negative
 * and cancel; if v0==w it's exactly 0), so `1 + sign*gamma*(v0-w)*t` never
 * drops to/below 0 for t >= 0 and the log is always well-defined — this is
 * what makes r(t) monotonic increasing and safe to bisect on.
 */
function dbmPositionKm(v0KmS: number, wKmS: number, r0Km: number, tSeconds: number): number {
  const sign = v0KmS > wKmS ? 1 : -1;
  const driftKmS = v0KmS - wKmS;
  const logArg = 1 + sign * GAMMA_PER_KM * driftKmS * tSeconds;
  return r0Km + (1 / GAMMA_PER_KM) * sign * Math.log(logArg) + wKmS * tSeconds;
}

/**
 * FORMULAS.md §6 — solve r(t) = 1 AU for t via bisection (not Newton, per
 * the doc's explicit instruction, since r is monotonic in t).
 */
export function solveCmeArrivalSeconds(
  v0KmS: number,
  ambientWindKmS: number = DEFAULT_AMBIENT_WIND_KM_S,
  r0Km: number = DEFAULT_R0_KM,
): number {
  const f = (tSeconds: number): number => dbmPositionKm(v0KmS, ambientWindKmS, r0Km, tSeconds);
  const initialHiSeconds = 24 * 3600; // 1 day; bisectionSolve doubles this until bracketed
  return bisectionSolve(f, AU_KM, 0, initialHiSeconds);
}

export interface CmeArrivalPrediction {
  arrivalTime: Date;
  earliestArrival: Date;
  latestArrival: Date;
  arrivalUncertaintySeconds: number;
}

/**
 * FORMULAS.md §6 — full arrival prediction including uncertainty:
 * propagate +-v0Error through the same bisection solve to get the +-delta-t
 * arrival window. A higher v0 (within error) arrives sooner; a lower v0
 * arrives later — earliest/latest are derived from whichever direction
 * that turns out to be, not assumed.
 */
export function predictCmeArrival(
  now: Date,
  v0KmS: number,
  v0ErrorKmS: number,
  ambientWindKmS: number = DEFAULT_AMBIENT_WIND_KM_S,
  r0Km: number = DEFAULT_R0_KM,
): CmeArrivalPrediction {
  const nominalSeconds = solveCmeArrivalSeconds(v0KmS, ambientWindKmS, r0Km);
  const fasterSeconds = solveCmeArrivalSeconds(v0KmS + v0ErrorKmS, ambientWindKmS, r0Km);
  const slowerSeconds = solveCmeArrivalSeconds(v0KmS - v0ErrorKmS, ambientWindKmS, r0Km);

  const earliestSeconds = Math.min(fasterSeconds, slowerSeconds);
  const latestSeconds = Math.max(fasterSeconds, slowerSeconds);

  const nowMs = now.getTime();
  return {
    arrivalTime: new Date(nowMs + nominalSeconds * 1000),
    earliestArrival: new Date(nowMs + earliestSeconds * 1000),
    latestArrival: new Date(nowMs + latestSeconds * 1000),
    arrivalUncertaintySeconds: (latestSeconds - earliestSeconds) / 2,
  };
}
