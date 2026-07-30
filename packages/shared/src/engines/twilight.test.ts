import { describe, expect, it } from 'vitest';
import {
  surfaceColorForSunAltitude,
  surfaceColorForTwilight,
  twilightStateForSunAltitude,
} from './twilight';

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

/** DESIGN_SPEC.md §4.1's four surface tokens, verbatim. */
const SKY_100_DAY = '#EEF1F1';
const SKY_600_NAUTICAL = '#3E4A4A';
const SKY_800_ASTRONOMICAL = '#1C2424';
const SKY_900_NIGHT = '#111818';
/** §4.1: "/explore only" — the 2D interface never uses pure black. */
const SKY_950_SCENE_VOID = '#0A0E0E';

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('surfaceColorForTwilight', () => {
  it('lands exactly on §4.1 sky-100 at value 0 (day surface)', () => {
    expect(surfaceColorForTwilight(0)).toBe(SKY_100_DAY);
  });

  it('lands exactly on §4.1 sky-600 at value 1 (nautical twilight surface)', () => {
    expect(surfaceColorForTwilight(1)).toBe(SKY_600_NAUTICAL);
  });

  it('lands exactly on §4.1 sky-800 at value 2 (astronomical twilight surface)', () => {
    expect(surfaceColorForTwilight(2)).toBe(SKY_800_ASTRONOMICAL);
  });

  it('lands exactly on §4.1 sky-900 at value 3 (night surface)', () => {
    expect(surfaceColorForTwilight(3)).toBe(SKY_900_NIGHT);
  });

  it('interpolates the civil segment (value 0.5) halfway between sky-100 and sky-600', () => {
    // R (0xEE+0x3E)/2 = 150 = 0x96; G/B (0xF1+0x4A)/2 = 157.5 -> 158 = 0x9E.
    expect(surfaceColorForTwilight(0.5)).toBe('#969E9E');
  });

  it('interpolates the nautical segment (value 1.5) halfway between sky-600 and sky-800', () => {
    expect(surfaceColorForTwilight(1.5)).toBe('#2D3737');
  });

  it('interpolates the astronomical segment (value 2.5) halfway between sky-800 and sky-900', () => {
    expect(surfaceColorForTwilight(2.5)).toBe('#171E1E');
  });

  it('clamps below the ramp to the day surface rather than extrapolating', () => {
    expect(surfaceColorForTwilight(-5)).toBe(SKY_100_DAY);
  });

  it('clamps above the ramp to the night surface rather than extrapolating', () => {
    expect(surfaceColorForTwilight(99)).toBe(SKY_900_NIGHT);
  });

  it('clamps +/-Infinity the same as an ordinary out-of-range value', () => {
    expect(surfaceColorForTwilight(Number.POSITIVE_INFINITY)).toBe(SKY_900_NIGHT);
    expect(surfaceColorForTwilight(Number.NEGATIVE_INFINITY)).toBe(SKY_100_DAY);
  });

  it('returns the night surface for NaN (the safe end for an outdoor screen)', () => {
    expect(surfaceColorForTwilight(Number.NaN)).toBe(SKY_900_NIGHT);
  });

  it('never brightens as the sky darkens, across the whole ramp', () => {
    let previous = relativeLuminance(surfaceColorForTwilight(0));
    for (let value = 0.01; value <= 3; value += 0.01) {
      const current = relativeLuminance(surfaceColorForTwilight(value));
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });

  it('always returns an uppercase #RRGGBB string, the notation §4.1 uses', () => {
    for (let value = -1; value <= 4; value += 0.037) {
      expect(surfaceColorForTwilight(value)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('never returns sky-950 — §4.1 reserves it for the 3D scene void', () => {
    for (let value = 0; value <= 3; value += 0.01) {
      expect(surfaceColorForTwilight(value)).not.toBe(SKY_950_SCENE_VOID);
    }
  });
});

describe('surfaceColorForSunAltitude', () => {
  it('gives the day surface for a sun well above the horizon', () => {
    expect(surfaceColorForSunAltitude(45)).toBe(SKY_100_DAY);
  });

  it('gives the nautical surface exactly at the -6deg boundary', () => {
    expect(surfaceColorForSunAltitude(-6)).toBe(SKY_600_NAUTICAL);
  });

  it('gives the astronomical surface exactly at the -12deg boundary', () => {
    expect(surfaceColorForSunAltitude(-12)).toBe(SKY_800_ASTRONOMICAL);
  });

  it('gives the night surface at and beyond the -18deg boundary', () => {
    expect(surfaceColorForSunAltitude(-18)).toBe(SKY_900_NIGHT);
    expect(surfaceColorForSunAltitude(-60)).toBe(SKY_900_NIGHT);
  });

  it('agrees with composing the two functions by hand', () => {
    for (const altDeg of [30, 0, -3, -6, -9, -12, -15, -18, -40]) {
      expect(surfaceColorForSunAltitude(altDeg)).toBe(
        surfaceColorForTwilight(twilightStateForSunAltitude(altDeg).value),
      );
    }
  });

  it('makes 22:00 and 16:00 visibly different surfaces (DESIGN_SPEC.md §2 thesis)', () => {
    // The whole premise of the twilight-accurate card: two different
    // real sun altitudes must not render the same background.
    expect(surfaceColorForSunAltitude(20)).not.toBe(surfaceColorForSunAltitude(-25));
  });
});
