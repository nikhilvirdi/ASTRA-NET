import { describe, expect, it } from 'vitest';
import {
  ACCRETION_DEFAULTS,
  approach,
  hexToRgb,
  idleDrift,
  pointerToParallax,
  sanitize,
} from './EtchedAccretion';

describe('EtchedAccretion helpers', () => {
  it('parses short and full hex colors and safely rejects invalid colors', () => {
    expect(hexToRgb('#f00')).toEqual([1, 0, 0]);
    expect(hexToRgb('#336699')).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255]);
    expect(hexToRgb('nope')).toEqual([0, 0, 0]);
  });

  it('approaches its target without overshooting and holds at zero delta', () => {
    expect(approach(0, 1, 0, 2)).toBe(0);
    expect(approach(0, 1, 0.1, 2)).toBeCloseTo(1 - Math.exp(-0.2));
    expect(approach(0.8, 0, 1, 2)).toBeGreaterThan(0);
  });

  it('maps pointer coordinates to a clamped parallax vector', () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 };
    expect(pointerToParallax(60, 45, rect)).toEqual([0, 0]);
    expect(pointerToParallax(200, -20, rect)).toEqual([1, 1]);
  });

  it('keeps idle parallax within the shader range', () => {
    for (let t = 0; t < 100; t += 1) {
      const [x, y] = idleDrift(t);
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('clamps unsafe shader parameters and replaces non-finite values', () => {
    const params = sanitize({ ...ACCRETION_DEFAULTS, holeSize: Infinity, speed: 99 });
    expect(params.holeSize).toBe(ACCRETION_DEFAULTS.holeSize);
    expect(params.speed).toBe(10);
  });
});
