import { describe, expect, it } from 'vitest';
import { twilightStateForSunAltitude } from './twilight';

describe('twilightStateForSunAltitude', () => {
  it('is day, value=0, for sun well above the horizon', () => {
    const result = twilightStateForSunAltitude(45);
    expect(result.phase).toBe('day');
    expect(result.value).toBe(0);
  });

  it('is day, value=0, for sun just above the horizon (0.01deg)', () => {
    const result = twilightStateForSunAltitude(0.01);
    expect(result.phase).toBe('day');
    expect(result.value).toBe(0);
  });

  it('exactly 0deg (day/civil boundary): civil, value=0', () => {
    const result = twilightStateForSunAltitude(0);
    expect(result.phase).toBe('civil');
    expect(result.value).toBe(0);
  });

  it('civil interior: -3deg is halfway through civil, value=0.5', () => {
    const result = twilightStateForSunAltitude(-3);
    expect(result.phase).toBe('civil');
    expect(result.value).toBeCloseTo(0.5, 10);
  });

  it('exactly -6deg (civil/nautical boundary, real-world anchor): nautical, value=1', () => {
    // US Naval Observatory / standard astronomical definition: civil
    // twilight ends and nautical twilight begins the instant the Sun's
    // center reaches 6deg below the horizon. Matches FORMULAS.md §0's
    // TWILIGHT_ISS_AURORA_DEG = -6, confirming DESIGN_SPEC.md §2 and
    // FORMULAS.md agree on this threshold, not by coincidence.
    const result = twilightStateForSunAltitude(-6);
    expect(result.phase).toBe('nautical');
    expect(result.value).toBe(1);
  });

  it('nautical interior: -9deg is halfway through nautical, value=1.5', () => {
    const result = twilightStateForSunAltitude(-9);
    expect(result.phase).toBe('nautical');
    expect(result.value).toBeCloseTo(1.5, 10);
  });

  it('exactly -12deg (nautical/astronomical boundary): astronomical, value=2', () => {
    const result = twilightStateForSunAltitude(-12);
    expect(result.phase).toBe('astronomical');
    expect(result.value).toBe(2);
  });

  it('astronomical interior: -15deg is halfway through astronomical, value=2.5', () => {
    const result = twilightStateForSunAltitude(-15);
    expect(result.phase).toBe('astronomical');
    expect(result.value).toBeCloseTo(2.5, 10);
  });

  it('exactly -18deg (astronomical/night boundary): night, value=3', () => {
    const result = twilightStateForSunAltitude(-18);
    expect(result.phase).toBe('night');
    expect(result.value).toBe(3);
  });

  it('is night, value=3, well past -18deg (no further gradient defined)', () => {
    const result = twilightStateForSunAltitude(-45);
    expect(result.phase).toBe('night');
    expect(result.value).toBe(3);
  });

  it('is continuous (no jump) across every named boundary', () => {
    const eps = 1e-9;
    for (const boundary of [0, -6, -12, -18]) {
      const above = twilightStateForSunAltitude(boundary + eps).value;
      const at = twilightStateForSunAltitude(boundary).value;
      const below = twilightStateForSunAltitude(boundary - eps).value;
      expect(Math.abs(above - at)).toBeLessThan(1e-6);
      expect(Math.abs(at - below)).toBeLessThan(1e-6);
    }
  });

  it('value is monotonically non-decreasing as altitude falls from 10deg to -30deg', () => {
    let prev = twilightStateForSunAltitude(10).value;
    for (let alt = 9; alt >= -30; alt -= 1) {
      const current = twilightStateForSunAltitude(alt).value;
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });
});
