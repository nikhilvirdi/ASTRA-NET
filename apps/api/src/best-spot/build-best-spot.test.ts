import { describe, it, expect } from 'vitest';
import { clarityFromCloudFraction, darknessFromBortle, travelDecay } from '@astranet/shared';
import { buildBestSpot, type CandidateObservation } from './build-best-spot.js';
import type { CandidateSite } from './candidates.js';
import type { OpenMeteoData } from '../clients/open-meteo/index.js';

const NOW = new Date('2026-07-27T20:00:00.000Z');
const OBSERVER = { latDeg: 32.7266, lonDeg: 74.857 };

function candidate(overrides: Partial<CandidateSite> = {}): CandidateSite {
  return {
    id: 'r25-b0',
    label: 'N 25 km',
    latDeg: 32.95,
    lonDeg: 74.857,
    distanceKm: 25,
    bearingDeg: 0,
    compass: 'N',
    ...overrides,
  };
}

function cloudAt(cloudCoverPercent: number, time = NOW.toISOString()): OpenMeteoData {
  return {
    latitude: 0,
    longitude: 0,
    hourly: [{ time, cloudCoverPercent, visibilityMeters: 20000 }],
    fetchedAt: NOW.toISOString(),
  };
}

function observation(over: Partial<CandidateObservation> = {}): CandidateObservation {
  return { candidate: candidate(), cloud: cloudAt(20), bortle: 4, ...over };
}

function build(
  observations: CandidateObservation[],
  over: Partial<Parameters<typeof buildBestSpot>[0]> = {},
) {
  return buildBestSpot({
    observer: OBSERVER,
    observations,
    kp: null,
    event: null,
    targetTime: NOW,
    now: NOW,
    ...over,
  });
}

describe('buildBestSpot — §11 scoring', () => {
  it('scores a site as exactly clarity x darkness x travel from the shared engine', () => {
    const payload = build([observation()]);
    const site = payload.sites[0]!;

    const expected = clarityFromCloudFraction(0.2) * darknessFromBortle(4) * travelDecay(25);
    expect(site.score).toBeCloseTo(expected, 12);
    expect(site.clarity.factor).toBeCloseTo(clarityFromCloudFraction(0.2), 12);
    expect(site.darkness.factor).toBeCloseTo(darknessFromBortle(4), 12);
    expect(site.travel.factor).toBeCloseTo(travelDecay(25), 12);
  });

  it('exposes each component separately, not just the final number (DESIGN_SPEC §12)', () => {
    const site = build([observation()]).sites[0]!;
    expect(site.clarity.cloudCoverPercent).toBe(20);
    expect(site.darkness.bortleClass).toBe(4);
    expect(site.travel.distanceKm).toBe(25);
    expect(site.travel.compass).toBe('N');
  });

  it('ranks best-first with contiguous 1..n ranks', () => {
    const payload = build([
      observation({ candidate: candidate({ id: 'far-bright' }), bortle: 8 }),
      observation({ candidate: candidate({ id: 'near-dark', distanceKm: 5 }), bortle: 2 }),
      observation({ candidate: candidate({ id: 'mid' }), bortle: 5 }),
    ]);

    expect(payload.sites.map((s) => s.id)).toEqual(['near-dark', 'mid', 'far-bright']);
    expect(payload.sites.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(payload.sites[0]!.score).toBeGreaterThan(payload.sites[1]!.score);
  });

  it('picks the cloud reading for the hour nearest the target time', () => {
    const cloud: OpenMeteoData = {
      latitude: 0,
      longitude: 0,
      hourly: [
        { time: '2026-07-27T18:00:00.000Z', cloudCoverPercent: 90, visibilityMeters: 1000 },
        { time: '2026-07-27T21:00:00.000Z', cloudCoverPercent: 10, visibilityMeters: 30000 },
        { time: '2026-07-28T03:00:00.000Z', cloudCoverPercent: 50, visibilityMeters: 20000 },
      ],
      fetchedAt: NOW.toISOString(),
    };
    const site = build([observation({ cloud })], {
      targetTime: new Date('2026-07-27T21:30:00.000Z'),
    }).sites[0]!;

    expect(site.clarity.cloudCoverPercent).toBe(10);
    expect(site.clarity.forecastTime).toBe('2026-07-27T21:00:00.000Z');
  });
});

describe('buildBestSpot — degradation', () => {
  it('omits clarity from the product rather than passing 0 when cloud data is missing', () => {
    const site = build([observation({ cloud: null })]).sites[0]!;

    // A zeroed clarity would kill the site outright (§11: "any zero kills the site").
    expect(site.score).toBeCloseTo(darknessFromBortle(4) * travelDecay(25), 12);
    expect(site.score).toBeGreaterThan(0);
    expect(site.clarity.factor).toBeNull();
    expect(site.clarity.available).toBe(false);
    expect(site.clarity.cloudCoverPercent).toBeNull();
  });

  it('carries DESIGN_SPEC §12s reduced-confidence header note when cloud data is out', () => {
    const payload = build([observation({ cloud: null })]);
    expect(payload.ranking.clarityAvailable).toBe(false);
    expect(payload.ranking.basis).toBe('darkness-travel');
    expect(payload.ranking.note).toContain('darkness and travel only');
    expect(payload.status).toBe('ok');
  });

  it('treats an empty hourly array the same as no cloud data', () => {
    const empty: OpenMeteoData = {
      latitude: 0,
      longitude: 0,
      hourly: [],
      fetchedAt: NOW.toISOString(),
    };
    const site = build([observation({ cloud: empty })]).sites[0]!;
    expect(site.clarity.available).toBe(false);
  });

  it('drops a candidate with no Bortle class rather than ranking it on travel alone', () => {
    const payload = build([
      observation({ candidate: candidate({ id: 'has-bortle' }), bortle: 3 }),
      observation({ candidate: candidate({ id: 'no-bortle' }), bortle: null }),
    ]);
    expect(payload.sites.map((s) => s.id)).toEqual(['has-bortle']);
  });

  it('reports unavailable when not one candidate could be scored', () => {
    const payload = build([observation({ bortle: null }), observation({ bortle: null })]);
    expect(payload.status).toBe('unavailable');
    expect(payload.sites).toEqual([]);
    // No sites means no note to make about them.
    expect(payload.ranking.note).toBeNull();
  });

  it('reports unavailable for an empty candidate set', () => {
    const payload = build([]);
    expect(payload.status).toBe('unavailable');
    expect(payload.sites).toEqual([]);
  });

  it('keeps clarityAvailable true when only some sites have cloud data', () => {
    const payload = build([
      observation({ candidate: candidate({ id: 'clouded' }) }),
      observation({ candidate: candidate({ id: 'no-cloud' }), cloud: null }),
    ]);
    expect(payload.ranking.clarityAvailable).toBe(true);
    expect(payload.ranking.basis).toBe('clarity-darkness-travel');
    expect(payload.ranking.note).toBeNull();
  });
});

describe('buildBestSpot — aurora tuning (§11)', () => {
  // Far north: inside the auroral oval at a moderate Kp.
  const arctic = { latDeg: 68.35, lonDeg: 18.82 };

  function arcticObservation(id: string, bortle = 3): CandidateObservation {
    return {
      candidate: candidate({ id, latDeg: arctic.latDeg, lonDeg: arctic.lonDeg, distanceKm: 10 }),
      cloud: cloudAt(10),
      bortle,
    };
  }

  it('does not apply an aurora factor unless the ranking asks for it', () => {
    const payload = build([arcticObservation('a')], { kp: 7, event: null });
    expect(payload.ranking.auroraApplied).toBe(false);
    expect(payload.sites[0]!.aurora).toBeNull();
  });

  it('multiplies the aurora factor in when aurora is genuinely visible', () => {
    const plain = build([arcticObservation('a')], { kp: 7, event: null });
    const tuned = build([arcticObservation('a')], { kp: 7, event: 'aurora' });

    expect(tuned.ranking.auroraApplied).toBe(true);
    const aurora = tuned.sites[0]!.aurora!;
    expect(aurora.visible).toBe(true);
    expect(aurora.factor).toBeGreaterThan(0);
    expect(aurora.kp).toBe(7);
    expect(tuned.sites[0]!.score).toBeCloseTo(plain.sites[0]!.score * aurora.factor, 12);
  });

  it('falls back to the plain score — never an all-zero ranking — when no site can see aurora', () => {
    // Equatorial observer: outside the oval at any realistic Kp.
    const equatorial = build(
      [
        {
          candidate: candidate({ id: 'tropics', latDeg: 1.35, lonDeg: 103.82 }),
          cloud: cloudAt(10),
          bortle: 4,
        },
      ],
      { kp: 5, event: 'aurora' },
    );

    expect(equatorial.ranking.auroraApplied).toBe(false);
    expect(equatorial.sites[0]!.score).toBeGreaterThan(0);
    expect(equatorial.ranking.note).toContain('No aurora is visible');
    // The per-site reading is still reported honestly.
    expect(equatorial.sites[0]!.aurora!.visible).toBe(false);
    expect(equatorial.sites[0]!.aurora!.factor).toBe(0);
  });

  it('ignores aurora tuning when Kp is unavailable', () => {
    const payload = build([arcticObservation('a')], { kp: null, event: 'aurora' });
    expect(payload.ranking.auroraApplied).toBe(false);
    expect(payload.sites[0]!.aurora).toBeNull();
    expect(payload.sites[0]!.score).toBeGreaterThan(0);
  });

  it('re-ranks so an aurora-visible site beats a darker one that cannot see it', () => {
    const payload = build(
      [
        // Pristine dark sky, but no aurora from the tropics.
        {
          candidate: candidate({
            id: 'dark-no-aurora',
            latDeg: 1.35,
            lonDeg: 103.82,
            distanceKm: 10,
          }),
          cloud: cloudAt(0),
          bortle: 1,
        },
        // Brighter, but inside the oval.
        arcticObservation('aurora-visible', 5),
      ],
      { kp: 7, event: 'aurora' },
    );

    expect(payload.ranking.auroraApplied).toBe(true);
    expect(payload.sites[0]!.id).toBe('aurora-visible');
  });
});

describe('buildBestSpot — payload envelope', () => {
  it('echoes the observer, target time and generation time', () => {
    const target = new Date('2026-07-27T22:30:00.000Z');
    const payload = build([observation()], { targetTime: target });

    expect(payload.observer).toEqual({ latDeg: OBSERVER.latDeg, lonDeg: OBSERVER.lonDeg });
    expect(payload.targetTime).toBe(target.toISOString());
    expect(payload.generatedAt).toBe(NOW.toISOString());
  });

  it('reports travelMinutes as null — no routing source exists to derive it honestly', () => {
    expect(build([observation()]).sites[0]!.travel.travelMinutes).toBeNull();
  });
});
