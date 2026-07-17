import { describe, expect, it } from 'vitest';
import { buildIssCard } from './iss-card';
import type {
  N2yoPositionsData,
  N2yoVisualPass,
  N2yoVisualPassesData,
} from '../clients/n2yo/index.js';
import type { SourceState } from '../poller/store.js';

const NOW = new Date('2026-07-17T12:00:00Z');
const NOW_SECONDS = NOW.getTime() / 1000;

function issState(data: N2yoPositionsData | null, healthy = true): SourceState<N2yoPositionsData> {
  return { data, fetchedAt: NOW.toISOString(), healthy };
}

function pass(startUtc: number, overrides: Partial<N2yoVisualPass> = {}): N2yoVisualPass {
  return {
    startAzimuth: 10,
    startAzimuthCompass: 'N',
    startElevation: 10,
    startUtc,
    maxAzimuth: 90,
    maxAzimuthCompass: 'E',
    maxElevation: 45,
    maxUtc: startUtc + 120,
    endAzimuth: 180,
    endAzimuthCompass: 'S',
    endElevation: 10,
    endUtc: startUtc + 240,
    magnitude: -2.5,
    duration: 240,
    ...overrides,
  };
}

describe('buildIssCard', () => {
  it('returns both position and next pass when everything resolves', () => {
    const positions: N2yoPositionsData = {
      satId: 25544,
      satName: 'ISS',
      positions: [
        {
          latitude: 12.3,
          longitude: 45.6,
          altitude: 420,
          azimuth: 0,
          elevation: 0,
          ra: 0,
          dec: 0,
          timestamp: NOW_SECONDS,
          eclipsed: false,
        },
      ],
      fetchedAt: NOW.toISOString(),
    };
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [pass(NOW_SECONDS + 3600)],
      fetchedAt: NOW.toISOString(),
    };

    const card = buildIssCard(issState(positions), visualPasses, NOW);

    expect(card.position).toEqual({
      latitude: 12.3,
      longitude: 45.6,
      altitude: 420,
      timestampUtc: NOW_SECONDS,
      fetchedAt: NOW.toISOString(),
      healthy: true,
    });
    expect(card.nextPass?.startUtc).toBe(NOW_SECONDS + 3600);
  });

  it('picks the soonest upcoming pass regardless of input order', () => {
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [pass(NOW_SECONDS + 7200), pass(NOW_SECONDS + 1800), pass(NOW_SECONDS + 3600)],
      fetchedAt: NOW.toISOString(),
    };

    const card = buildIssCard(issState(null, false), visualPasses, NOW);

    expect(card.nextPass?.startUtc).toBe(NOW_SECONDS + 1800);
  });

  it('ignores passes that have already started', () => {
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [pass(NOW_SECONDS - 100), pass(NOW_SECONDS + 500)],
      fetchedAt: NOW.toISOString(),
    };

    const card = buildIssCard(issState(null, false), visualPasses, NOW);

    expect(card.nextPass?.startUtc).toBe(NOW_SECONDS + 500);
  });

  it('degrades position independently of next-pass — store down but passes fetched', () => {
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [pass(NOW_SECONDS + 500)],
      fetchedAt: NOW.toISOString(),
    };

    const card = buildIssCard(issState(null, false), visualPasses, NOW);

    expect(card.position).toBeNull();
    expect(card.nextPass).not.toBeNull();
  });

  it('degrades next-pass independently of position — passes call failed but store healthy', () => {
    const positions: N2yoPositionsData = {
      satId: 25544,
      satName: 'ISS',
      positions: [
        {
          latitude: 1,
          longitude: 2,
          altitude: 400,
          azimuth: 0,
          elevation: 0,
          ra: 0,
          dec: 0,
          timestamp: NOW_SECONDS,
          eclipsed: false,
        },
      ],
      fetchedAt: NOW.toISOString(),
    };

    const card = buildIssCard(issState(positions), null, NOW);

    expect(card.position).not.toBeNull();
    expect(card.nextPass).toBeNull();
  });

  it('returns both null when nothing resolves', () => {
    const card = buildIssCard(issState(null, false), null, NOW);
    expect(card.position).toBeNull();
    expect(card.nextPass).toBeNull();
  });
});
