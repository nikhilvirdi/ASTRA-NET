import { describe, expect, it } from 'vitest';
import {
  resolveSatelliteFeed,
  simSatCountFromSearch,
  simulatedSatellites,
} from './dev-sim-satellites';

describe('simSatCountFromSearch', () => {
  it('is 0 with no simSats param', () => {
    expect(simSatCountFromSearch('')).toBe(0);
  });

  it('is 0 for simSats=0 and invalid values', () => {
    expect(simSatCountFromSearch('?simSats=0')).toBe(0);
    expect(simSatCountFromSearch('?simSats=abc')).toBe(0);
    expect(simSatCountFromSearch('?simSats=-5')).toBe(0);
  });

  it('parses and clamps a positive count to 200', () => {
    expect(simSatCountFromSearch('?simSats=40')).toBe(40);
    expect(simSatCountFromSearch('?simSats=999')).toBe(200);
  });
});

describe('simulatedSatellites', () => {
  it('generates the requested count, deterministically', () => {
    const a = simulatedSatellites(10);
    const b = simulatedSatellites(10);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
  });
});

describe('resolveSatelliteFeed', () => {
  // Regression test for a real shipped bug: the original condition compared
  // simSatCountFromSearch()'s return (always a number, 0 when disabled)
  // against `null`, which is never true — the real-feed branch below it was
  // permanently unreachable in every configuration, dev or production.
  it('uses the real feed when no simSats param is present, even when it is the only non-empty list', () => {
    const real = [{ id: 'real-1' }, { id: 'real-2' }];
    const sim: typeof real = [];

    const resolved = resolveSatelliteFeed('', sim, real);

    expect(resolved).toBe(real);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('uses the real feed for simSats=0 and invalid simSats too', () => {
    const real = [{ id: 'real-1' }];
    expect(resolveSatelliteFeed('?simSats=0', [], real)).toBe(real);
    expect(resolveSatelliteFeed('?simSats=abc', [], real)).toBe(real);
  });

  it('uses the simulated feed only when simSats is a positive count', () => {
    const real = [{ id: 'real-1' }];
    const sim = [{ id: 'sim-1' }, { id: 'sim-2' }];
    expect(resolveSatelliteFeed('?simSats=5', sim, real)).toBe(sim);
  });
});
