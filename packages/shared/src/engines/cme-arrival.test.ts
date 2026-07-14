import { describe, expect, it } from 'vitest';
import { predictCmeArrival, solveCmeArrivalSeconds } from './cme-arrival';

const HOUR = 3600;

describe('solveCmeArrivalSeconds', () => {
  it('solves_when_v0_greater_than_w', () => {
    // v0=1000 km/s (fast/decelerating CME), w=400 km/s ambient wind.
    // Hand-derived via the DBM formula (FORMULAS.md §6): r0 = 21.5*R_SUN ~= 1.4958e7 km,
    // target diff to 1 AU ~= 1.34624e8 km. Solving
    //   1.34624e8 = 2e7*ln(1 + 3e-5*t) + 400*t
    // by hand bisection lands at t ~= 232,500 s (~64.6 hours) -- within the
    // typical 1-3 day real-world CME transit range (e.g. widely reported
    // ~2.7-day transit for a ~1000 km/s CME decelerating toward the ambient
    // wind speed).
    const seconds = solveCmeArrivalSeconds(1000, 400);
    expect(seconds).toBeGreaterThan(60 * HOUR);
    expect(seconds).toBeLessThan(70 * HOUR);
  });

  it('solves_when_v0_less_than_w', () => {
    // v0=300 km/s (slow/accelerating CME), w=400 km/s ambient wind.
    // Hand-derived via the same formula with sign=-1:
    //   1.34624e8 = -2e7*ln(1 + 5e-6*t) + 400*t
    // lands at t ~= 390,700 s (~108.5 hours) -- slower than a constant-400
    // km/s transit (~93.4h) would suggest slightly less, since drag
    // acceleration helps it along, consistent with the direction of the effect.
    const seconds = solveCmeArrivalSeconds(300, 400);
    expect(seconds).toBeGreaterThan(100 * HOUR);
    expect(seconds).toBeLessThan(120 * HOUR);
  });

  it('a faster CME (v0 > w) arrives sooner than a slower one (v0 < w) for the same wind', () => {
    const fast = solveCmeArrivalSeconds(1000, 400);
    const slow = solveCmeArrivalSeconds(300, 400);
    expect(fast).toBeLessThan(slow);
  });

  it('uses the default ambient wind speed (400 km/s) when omitted', () => {
    expect(solveCmeArrivalSeconds(1000)).toBeCloseTo(solveCmeArrivalSeconds(1000, 400), 3);
  });
});

describe('predictCmeArrival', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('arrival_uncertainty_widens_with_speed_error', () => {
    const narrow = predictCmeArrival(now, 1000, 10);
    const wide = predictCmeArrival(now, 1000, 100);
    expect(wide.arrivalUncertaintySeconds).toBeGreaterThan(narrow.arrivalUncertaintySeconds);
  });

  it('places the nominal arrival time between the earliest and latest bounds', () => {
    const prediction = predictCmeArrival(now, 1000, 50);
    expect(prediction.arrivalTime.getTime()).toBeGreaterThanOrEqual(
      prediction.earliestArrival.getTime(),
    );
    expect(prediction.arrivalTime.getTime()).toBeLessThanOrEqual(
      prediction.latestArrival.getTime(),
    );
  });

  it('derives earliest/latest correctly for a slow (v0 < w) CME too', () => {
    // Here a *lower* v0 (within error) means even more acceleration lag,
    // so the direction of "faster => earlier" must still hold regardless
    // of which side of w the nominal v0 sits on.
    const prediction = predictCmeArrival(now, 300, 50);
    expect(prediction.earliestArrival.getTime()).toBeLessThan(prediction.latestArrival.getTime());
  });

  it('anchors arrival times to the injected `now`, not the system clock', () => {
    const later = new Date(now.getTime() + 1000 * 3600);
    const predictionNow = predictCmeArrival(now, 1000, 50);
    const predictionLater = predictCmeArrival(later, 1000, 50);
    expect(predictionLater.arrivalTime.getTime() - predictionNow.arrivalTime.getTime()).toBe(
      1000 * 3600,
    );
  });
});
