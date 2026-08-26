import { describe, expect, it } from 'vitest';
import type { DailyBrief } from './api';
import {
  ISS_PASS_WINDOW_HOURS,
  NEO_NOTABLE_LD,
  PLANET_HIGH_ALTITUDE_DEG,
  selectHeadline,
} from './brief-headline';

const NOW = new Date(2026, 7, 26, 22, 0, 0); // Aug 26 2026, 22:00 local
const clock = (d: Date): string => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A brief with every headline trigger switched off — tests turn on one at a time. */
function quietBrief(): DailyBrief {
  return {
    observer: { latDeg: 40.71, lonDeg: -74.01 },
    generatedAt: NOW.toISOString(),
    status: 'ok',
    skyAnchor: {
      status: 'ok',
      data: {
        sunAltitudeDeg: -30,
        sunAzimuthDeg: 20,
        twilightPhase: 'night',
        isDarkEnoughForIssOrAurora: true,
        isDarkEnoughForFaintStars: true,
        jupiter: { azimuthDeg: 120, altitudeDeg: 5 },
        venus: { azimuthDeg: 78, altitudeDeg: -20 },
        mars: { azimuthDeg: 96, altitudeDeg: 2 },
        saturn: { azimuthDeg: 150, altitudeDeg: -30 },
        mercury: { azimuthDeg: 66, altitudeDeg: -40 },
        moon: {
          altitudeDeg: 20,
          azimuthDeg: 135,
          phaseName: 'waxingCrescent',
          illuminatedFraction: 0.2,
          phaseAngleDeg: 50,
          nextRiseUtc: null,
          nextSetUtc: null,
        },
      },
    },
    iss: { status: 'ok', data: { position: null, nextPass: null } },
    spaceWeather: {
      status: 'ok',
      data: {
        solarLine: {
          headline: '',
          live: { speedKmS: 400, kp: 1, fetchedAt: null, healthy: true },
          forecast: { kp: 1, status: 'estimated', fetchedAt: null, healthy: true },
        },
        aurora: {
          kpPredicted: 1,
          kpForecastStatus: 'estimated',
          kpForecastTimeTag: '',
          visible: false,
          strengthDeg: -40,
          strengthFactor: 0,
          geomagneticLatitudeDeg: 20,
          auroraOvalBoundaryDeg: 64,
          hasActiveCme: false,
          cmeArrivalTime: null,
          cmeActivityId: null,
          confidence: 0.1,
          confidenceBand: 'LOW',
          factors: null,
          leadHours: null,
        },
      },
    },
    neoImagery: { status: 'ok', data: { neo: null, imagery: null } },
    learningMoment: '',
  };
}

const withAurora = (b: DailyBrief, strengthFactor: number): DailyBrief => {
  b.spaceWeather.data!.aurora!.strengthFactor = strengthFactor;
  return b;
};
const withCme = (b: DailyBrief, leadHours: number | null): DailyBrief => {
  b.spaceWeather.data!.aurora!.hasActiveCme = true;
  b.spaceWeather.data!.aurora!.leadHours = leadHours;
  return b;
};
const withPass = (b: DailyBrief, startMs: number, endMs: number): DailyBrief => {
  b.iss.data!.nextPass = {
    startUtc: Math.floor(startMs / 1000),
    maxUtc: Math.floor((startMs + endMs) / 2000),
    endUtc: Math.floor(endMs / 1000),
    maxElevationDeg: 42,
    magnitude: -3.4,
    durationSeconds: Math.floor((endMs - startMs) / 1000),
    startAzimuthDeg: 200,
    startAzimuthCompass: 'SSW',
    maxAzimuthDeg: 215,
    maxAzimuthCompass: 'SW',
    endAzimuthDeg: 230,
    endAzimuthCompass: 'SW',
  };
  return b;
};
const withNeo = (
  b: DailyBrief,
  approachDate: string,
  ld: number,
  hazardous = false,
): DailyBrief => {
  b.neoImagery.data!.neo = {
    id: '1',
    name: '(2026 AB)',
    nasaJplUrl: '',
    isPotentiallyHazardous: hazardous,
    diameterKm: 0.1,
    closeApproachDate: approachDate,
    missDistanceKm: ld * 384_400,
    missDistanceLunarDistances: ld,
    velocityKmS: 12,
  };
  return b;
};
const withPlanet = (
  b: DailyBrief,
  key: 'jupiter' | 'venus' | 'saturn',
  alt: number,
): DailyBrief => {
  b.skyAnchor.data![key] = { azimuthDeg: 100, altitudeDeg: alt };
  return b;
};
const withMoonPhase = (b: DailyBrief, phaseName: string, illum: number): DailyBrief => {
  b.skyAnchor.data!.moon!.phaseName = phaseName;
  b.skyAnchor.data!.moon!.illuminatedFraction = illum;
  return b;
};

const HOUR = 3_600_000;

describe('selectHeadline — each condition on its own', () => {
  it('reports an aurora chance when the storm reaches this latitude', () => {
    const h = selectHeadline(withAurora(quietBrief(), 0.25), NOW, clock);
    expect(h.kind).toBe('aurora-chance');
    expect(h.text).toBe('A solar storm gives you a 1 in 4 chance of aurora.');
  });

  it('floors the aurora odds at 1 in 2 rather than overstating a near-certain storm', () => {
    const h = selectHeadline(withAurora(quietBrief(), 0.95), NOW, clock);
    expect(h.emphasis).toBe('1 in 2');
  });

  it('reports an inbound CME when there is no aurora chance here', () => {
    const h = selectHeadline(withCme(quietBrief(), 42.4), NOW, clock);
    expect(h.kind).toBe('cme-inbound');
    expect(h.text).toContain('42 hours');
    expect(h.text).toContain('too far south');
  });

  it('reports an inbound CME without a lead time when none is known', () => {
    const h = selectHeadline(withCme(quietBrief(), null), NOW, clock);
    expect(h.kind).toBe('cme-inbound');
    expect(h.emphasis).toBeNull();
  });

  it('reports an ISS pass inside the window', () => {
    const start = NOW.getTime() + 2 * HOUR;
    const h = selectHeadline(withPass(quietBrief(), start, start + 600_000), NOW, clock);
    expect(h.kind).toBe('iss-pass');
    expect(h.text).toBe('The ISS crosses your sky at 0:00.');
  });

  it('ignores a pass that has already finished', () => {
    const start = NOW.getTime() - 3 * HOUR;
    const h = selectHeadline(withPass(quietBrief(), start, start + 600_000), NOW, clock);
    expect(h.kind).toBe('quiet');
  });

  it('ignores a pass beyond the window, leaving the slot for something nearer', () => {
    const start = NOW.getTime() + (ISS_PASS_WINDOW_HOURS + 2) * HOUR;
    const h = selectHeadline(withPass(quietBrief(), start, start + 600_000), NOW, clock);
    expect(h.kind).toBe('quiet');
  });

  it('keeps a pass that is in progress right now', () => {
    const h = selectHeadline(
      withPass(quietBrief(), NOW.getTime() - 120_000, NOW.getTime() + 120_000),
      NOW,
      clock,
    );
    expect(h.kind).toBe('iss-pass');
  });

  it('reports a NEO approaching today even when it is not especially close', () => {
    const h = selectHeadline(withNeo(quietBrief(), '2026-08-26', NEO_NOTABLE_LD * 4), NOW, clock);
    expect(h.kind).toBe('neo-approach');
    expect(h.text).toContain('passes Earth today');
  });

  it('reports a close NEO on a future date', () => {
    const h = selectHeadline(withNeo(quietBrief(), '2026-08-31', 4.2), NOW, clock);
    expect(h.kind).toBe('neo-approach');
    expect(h.emphasis).toBe('4.2 lunar distances');
  });

  it('adds the hazard note only for a listed object', () => {
    expect(selectHeadline(withNeo(quietBrief(), '2026-08-31', 4, true), NOW, clock).text).toContain(
      'potentially-hazardous',
    );
    expect(
      selectHeadline(withNeo(quietBrief(), '2026-08-31', 4, false), NOW, clock).text,
    ).not.toContain('potentially-hazardous');
  });

  it('ignores a distant future approach and an approach already past', () => {
    expect(selectHeadline(withNeo(quietBrief(), '2026-09-30', 40), NOW, clock).kind).toBe('quiet');
    expect(selectHeadline(withNeo(quietBrief(), '2026-08-01', 1), NOW, clock).kind).toBe('quiet');
  });

  it('reports a well-placed planet', () => {
    const h = selectHeadline(withPlanet(quietBrief(), 'jupiter', 55.4), NOW, clock);
    expect(h.kind).toBe('planet-high');
    expect(h.text).toBe('Jupiter is well placed tonight, 55° above your horizon.');
  });

  it('ignores a planet below the altitude threshold', () => {
    const h = selectHeadline(
      withPlanet(quietBrief(), 'jupiter', PLANET_HIGH_ALTITUDE_DEG - 0.1),
      NOW,
      clock,
    );
    expect(h.kind).toBe('quiet');
  });

  it('takes a planet exactly at the threshold', () => {
    const h = selectHeadline(
      withPlanet(quietBrief(), 'jupiter', PLANET_HIGH_ALTITUDE_DEG),
      NOW,
      clock,
    );
    expect(h.kind).toBe('planet-high');
  });

  it('ignores a high planet in daylight, when it cannot actually be observed', () => {
    const b = withPlanet(quietBrief(), 'jupiter', 60);
    b.skyAnchor.data!.twilightPhase = 'day';
    expect(selectHeadline(b, NOW, clock).kind).toBe('quiet');
  });

  it('picks the highest planet, not the first one checked', () => {
    const b = withPlanet(withPlanet(quietBrief(), 'venus', 35), 'saturn', 70);
    expect(selectHeadline(b, NOW, clock).text).toContain('Saturn');
  });

  it('breaks an exact altitude tie towards the brighter planet', () => {
    const b = withPlanet(withPlanet(quietBrief(), 'saturn', 50), 'venus', 50);
    expect(selectHeadline(b, NOW, clock).text).toContain('Venus');
  });

  it('reports a full Moon', () => {
    const h = selectHeadline(withMoonPhase(quietBrief(), 'full', 0.97), NOW, clock);
    expect(h.kind).toBe('moon-phase');
    expect(h.text).toBe('A full Moon tonight, 97% lit — bright enough to wash out the faint sky.');
  });

  it('reports a new Moon', () => {
    const h = selectHeadline(withMoonPhase(quietBrief(), 'new', 0.01), NOW, clock);
    expect(h.kind).toBe('moon-phase');
    expect(h.text).toContain('darkest sky');
  });

  it('ignores an in-between Moon phase', () => {
    expect(selectHeadline(withMoonPhase(quietBrief(), 'waxingGibbous', 0.7), NOW, clock).kind).toBe(
      'quiet',
    );
  });
});

describe('selectHeadline — priority ordering', () => {
  it('aurora beats everything else stacked together', () => {
    let b = withAurora(quietBrief(), 0.2);
    b = withCme(b, 20);
    b = withPass(b, NOW.getTime() + HOUR, NOW.getTime() + HOUR + 600_000);
    b = withNeo(b, '2026-08-26', 1);
    b = withPlanet(b, 'jupiter', 70);
    b = withMoonPhase(b, 'full', 1);
    expect(selectHeadline(b, NOW, clock).kind).toBe('aurora-chance');
  });

  it('an inbound CME outranks an ISS pass', () => {
    let b = withCme(quietBrief(), 30);
    b = withPass(b, NOW.getTime() + HOUR, NOW.getTime() + HOUR + 600_000);
    expect(selectHeadline(b, NOW, clock).kind).toBe('cme-inbound');
  });

  it('an ISS pass outranks a NEO, a planet and the Moon', () => {
    let b = withPass(quietBrief(), NOW.getTime() + HOUR, NOW.getTime() + HOUR + 600_000);
    b = withNeo(b, '2026-08-26', 1);
    b = withPlanet(b, 'jupiter', 70);
    b = withMoonPhase(b, 'full', 1);
    expect(selectHeadline(b, NOW, clock).kind).toBe('iss-pass');
  });

  it('a NEO outranks a planet and the Moon', () => {
    let b = withNeo(quietBrief(), '2026-08-26', 1);
    b = withPlanet(b, 'jupiter', 70);
    b = withMoonPhase(b, 'full', 1);
    expect(selectHeadline(b, NOW, clock).kind).toBe('neo-approach');
  });

  it('a planet outranks the Moon', () => {
    const b = withMoonPhase(withPlanet(quietBrief(), 'jupiter', 70), 'full', 1);
    expect(selectHeadline(b, NOW, clock).kind).toBe('planet-high');
  });

  it('falls through the whole ladder in order as each event is removed', () => {
    // Build everything on, then strip one layer at a time and watch the
    // headline step down the priority list exactly once per removal.
    let b = withMoonPhase(
      withPlanet(
        withNeo(
          withPass(
            withCme(withAurora(quietBrief(), 0.2), 30),
            NOW.getTime() + HOUR,
            NOW.getTime() + HOUR + 600_000,
          ),
          '2026-08-26',
          1,
        ),
        'jupiter',
        70,
      ),
      'full',
      1,
    );
    expect(selectHeadline(b, NOW, clock).kind).toBe('aurora-chance');

    b.spaceWeather.data!.aurora!.strengthFactor = 0;
    expect(selectHeadline(b, NOW, clock).kind).toBe('cme-inbound');

    b.spaceWeather.data!.aurora!.hasActiveCme = false;
    expect(selectHeadline(b, NOW, clock).kind).toBe('iss-pass');

    b.iss.data!.nextPass = null;
    expect(selectHeadline(b, NOW, clock).kind).toBe('neo-approach');

    b.neoImagery.data!.neo = null;
    expect(selectHeadline(b, NOW, clock).kind).toBe('planet-high');

    // Jupiter was the only planet above the threshold — the rest of the fixture
    // sits below it — so dropping it clears the whole planet rung.
    b = withPlanet(b, 'jupiter', 5);
    expect(selectHeadline(b, NOW, clock).kind).toBe('moon-phase');

    b = withMoonPhase(b, 'waningGibbous', 0.8);
    expect(selectHeadline(b, NOW, clock).kind).toBe('quiet');
  });
});

describe('selectHeadline — degraded input', () => {
  it('is quiet for a null brief', () => {
    expect(selectHeadline(null, NOW, clock).kind).toBe('quiet');
  });

  it('is quiet when every card is unavailable', () => {
    const b: DailyBrief = {
      observer: { latDeg: 0, lonDeg: 0 },
      generatedAt: NOW.toISOString(),
      status: 'unavailable',
      skyAnchor: { status: 'unavailable', data: null },
      iss: { status: 'unavailable', data: null },
      spaceWeather: { status: 'unavailable', data: null },
      neoImagery: { status: 'unavailable', data: null },
      learningMoment: '',
    };
    expect(selectHeadline(b, NOW, clock).kind).toBe('quiet');
  });

  it('survives a sky anchor with no moon field at all', () => {
    const b = quietBrief();
    delete b.skyAnchor.data!.moon;
    expect(selectHeadline(b, NOW, clock).kind).toBe('quiet');
  });

  it('always produces text matching its own parts', () => {
    const cases = [
      withAurora(quietBrief(), 0.2),
      withCme(quietBrief(), 12),
      withPass(quietBrief(), NOW.getTime() + HOUR, NOW.getTime() + HOUR + 600_000),
      withNeo(quietBrief(), '2026-08-26', 2),
      withPlanet(quietBrief(), 'venus', 40),
      withMoonPhase(quietBrief(), 'full', 1),
      quietBrief(),
    ];
    for (const b of cases) {
      const h = selectHeadline(b, NOW, clock);
      expect(h.text).toBe(`${h.lead}${h.emphasis ?? ''}${h.tail}`);
      expect(h.text.length).toBeGreaterThan(10);
    }
  });
});
