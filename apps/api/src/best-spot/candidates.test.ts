import { describe, it, expect } from 'vitest';
import { haversineDistanceKm } from '@astranet/shared';
import {
  generateCandidateSites,
  CANDIDATE_RING_RADII_KM,
  CANDIDATE_BEARINGS_DEG,
} from './candidates.js';

const JAMMU = { latDeg: 32.7266, lonDeg: 74.857 };

describe('generateCandidateSites', () => {
  it('produces the observer plus a full ring x bearing grid', () => {
    const sites = generateCandidateSites(JAMMU);
    expect(sites).toHaveLength(1 + CANDIDATE_RING_RADII_KM.length * CANDIDATE_BEARINGS_DEG.length);
  });

  it('puts the observer first, at zero distance', () => {
    const [first] = generateCandidateSites(JAMMU);
    expect(first!.id).toBe('origin');
    expect(first!.distanceKm).toBe(0);
    expect(first!.latDeg).toBe(JAMMU.latDeg);
    expect(first!.lonDeg).toBe(JAMMU.lonDeg);
    expect(first!.bearingDeg).toBeNull();
    expect(first!.compass).toBeNull();
  });

  it('reports each site at the distance it was actually generated at', () => {
    for (const site of generateCandidateSites(JAMMU)) {
      const measured = haversineDistanceKm(JAMMU, { latDeg: site.latDeg, lonDeg: site.lonDeg });
      expect(site.distanceKm).toBeCloseTo(measured, 9);
    }
  });

  it('lands every ring site on its nominal radius', () => {
    const sites = generateCandidateSites(JAMMU).filter((s) => s.id !== 'origin');
    for (const site of sites) {
      const radius = Number(/^r(\d+)-/.exec(site.id)![1]);
      expect(site.distanceKm).toBeCloseTo(radius, 6);
    }
  });

  it('labels sites by compass bearing and distance, never with a place name', () => {
    const sites = generateCandidateSites(JAMMU);
    expect(sites.find((s) => s.id === 'r25-b45')!.label).toBe('NE 25 km');
    expect(sites.find((s) => s.id === 'r10-b270')!.label).toBe('W 10 km');
    expect(sites[0]!.label).toBe('Your location');
  });

  it('gives every site a unique id', () => {
    const ids = generateCandidateSites(JAMMU).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic — the same observer yields an identical set', () => {
    expect(generateCandidateSites(JAMMU)).toEqual(generateCandidateSites(JAMMU));
  });

  it('keeps coordinates valid near the antimeridian', () => {
    for (const site of generateCandidateSites({ latDeg: 0, lonDeg: 179.95 })) {
      expect(site.lonDeg).toBeGreaterThanOrEqual(-180);
      expect(site.lonDeg).toBeLessThan(180);
      expect(Number.isNaN(site.latDeg)).toBe(false);
    }
  });

  it('keeps coordinates valid at high latitude', () => {
    for (const site of generateCandidateSites({ latDeg: 89.5, lonDeg: 0 })) {
      expect(site.latDeg).toBeLessThanOrEqual(90);
      expect(site.latDeg).toBeGreaterThanOrEqual(-90);
    }
  });
});
