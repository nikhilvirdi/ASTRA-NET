import { describe, expect, it } from 'vitest';
import { buildBrief } from './build-brief';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';
import type { PollerState, SourceState } from '../poller/store.js';

const NOW = new Date('2026-07-17T12:00:00Z');
const NOW_SECONDS = NOW.getTime() / 1000;

function empty<T>(): SourceState<T> {
  return { data: null, fetchedAt: null, healthy: false };
}

function emptyPollerState(): PollerState {
  return {
    iss: empty(),
    solarWind: empty(),
    spaceWeatherForecast: empty(),
    donki: empty(),
    neows: empty(),
    gibs: empty(),
    horizons: empty(),
    horizonsJupiter: empty(),
    horizonsVenus: empty(),
    horizonsMars: empty(),
    horizonsSaturn: empty(),
    horizonsMercury: empty(),
    satellites: empty(),
  };
}

function fullPollerState(): PollerState {
  const state = emptyPollerState();
  state.solarWind = {
    data: {
      kpCurrent: { timeTag: NOW.toISOString(), kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
      rtswPlasma: {
        timeTag: NOW.toISOString(),
        source: 'DSCOVR',
        protonSpeed: 420,
        protonDensity: 5,
        protonTemperature: 100000,
        overallQuality: 0,
      },
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.spaceWeatherForecast = {
    data: {
      kpObserved: null,
      kpForecast: [{ timeTag: NOW.toISOString(), kp: 4, status: 'predicted', noaaScale: null }],
      solarWind: null,
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.donki = {
    data: { cmes: [], flares: null, fetchedAt: NOW.toISOString() },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.iss = {
    data: {
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
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.neows = {
    data: {
      elementCount: 1,
      objects: [
        {
          id: 'neo-1',
          name: '(2026 AA1)',
          nasaJplUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=neo-1',
          absoluteMagnitudeH: 20,
          estimatedDiameterMinKm: 0.1,
          estimatedDiameterMaxKm: 0.3,
          isPotentiallyHazardous: false,
          isSentryObject: false,
          closeApproaches: [
            {
              date: '2026-07-18',
              epochDate: 1_800_000_000_000,
              velocityKmS: 12.3,
              missDistanceKm: 500_000,
              orbitingBody: 'Earth',
            },
          ],
        },
      ],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.gibs = {
    data: { layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', date: '2026-07-16' },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.horizonsJupiter = {
    data: {
      entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 129.42611, decDeg: 18.09309 }],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.horizonsVenus = {
    data: {
      entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 169.5, decDeg: 4.9 }],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.horizonsMars = {
    data: {
      entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 210.1, decDeg: -15.2 }],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.horizonsSaturn = {
    data: {
      entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 330.4, decDeg: -12.7 }],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  state.horizonsMercury = {
    data: {
      entries: [{ timestampUtcMs: NOW.getTime(), raDeg: 140.2, decDeg: 15.8 }],
      fetchedAt: NOW.toISOString(),
    },
    fetchedAt: NOW.toISOString(),
    healthy: true,
  };
  return state;
}

const NO_VISUAL_PASSES: N2yoVisualPassesData | null = null;
const NEUTRAL_HISTORY = { hits: 0, trials: 0 };

describe('buildBrief — degradation contract (ARCHITECTURE.md §5)', () => {
  it('full-data case: every available card resolves', () => {
    const brief = buildBrief(fullPollerState(), 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.skyAnchor.data?.jupiter).not.toBeNull();
    expect(Number.isFinite(brief.skyAnchor.data?.jupiter?.altitudeDeg)).toBe(true);
    expect(Number.isFinite(brief.skyAnchor.data?.jupiter?.azimuthDeg)).toBe(true);
    for (const planet of ['venus', 'mars', 'saturn', 'mercury'] as const) {
      expect(brief.skyAnchor.data?.[planet]).not.toBeNull();
      expect(Number.isFinite(brief.skyAnchor.data?.[planet]?.altitudeDeg)).toBe(true);
      expect(Number.isFinite(brief.skyAnchor.data?.[planet]?.azimuthDeg)).toBe(true);
    }
    expect(brief.iss.status).toBe('ok');
    expect(brief.iss.data?.position?.latitude).toBe(12.3);
    expect(brief.iss.data?.nextPass).toBeNull();
    expect(brief.spaceWeather.status).toBe('ok');
    expect(brief.spaceWeather.data?.solarLine.headline).toBe('solar wind 420 km/s, Kp 4');
    expect(brief.spaceWeather.data?.aurora).not.toBeNull();
    expect(brief.neoImagery.status).toBe('ok');
    expect(brief.neoImagery.data?.neo?.id).toBe('neo-1');
    expect(brief.neoImagery.data?.imagery?.layer).toBe('VIIRS_SNPP_CorrectedReflectance_TrueColor');
    expect(brief.learningMoment.length).toBeGreaterThan(0);
  });

  it('includes an on-demand next-pass when the HTTP layer supplies one', () => {
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [
        {
          startAzimuth: 10,
          startAzimuthCompass: 'N',
          startElevation: 10,
          startUtc: NOW_SECONDS + 3600,
          maxAzimuth: 90,
          maxAzimuthCompass: 'E',
          maxElevation: 45,
          maxUtc: NOW_SECONDS + 3720,
          endAzimuth: 180,
          endAzimuthCompass: 'S',
          endElevation: 10,
          endUtc: NOW_SECONDS + 3840,
          magnitude: -2.5,
          duration: 240,
        },
      ],
      fetchedAt: NOW.toISOString(),
    };

    const brief = buildBrief(fullPollerState(), 45, -75, NOW, visualPasses, NEUTRAL_HISTORY);

    expect(brief.iss.status).toBe('ok');
    expect(brief.iss.data?.nextPass?.startUtc).toBe(NOW_SECONDS + 3600);
  });

  it('partial-outage case: one source down blanks only its own card', () => {
    const state = fullPollerState();
    // Simulate DONKI down — space weather (SWPC-driven) must still resolve.
    state.donki = empty();

    const brief = buildBrief(state, 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.spaceWeather.status).toBe('ok');
    expect(brief.spaceWeather.data?.aurora?.hasActiveCme).toBe(false);
  });

  it('partial-outage case: SWPC entirely down blanks only the space-weather card', () => {
    const state = fullPollerState();
    state.solarWind = empty();
    state.spaceWeatherForecast = empty();

    const brief = buildBrief(state, 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.iss.status).toBe('ok');
    expect(brief.spaceWeather.status).toBe('unavailable');
    expect(brief.spaceWeather.data).toBeNull();
  });

  it('partial-outage case: SWPC failed with no prior value — the state the poller really writes', () => {
    // The test above uses `empty()` (`data: null`), which the poller only
    // ever produces before the very first tick. On a real total failure with
    // nothing cached, `fast-tier.ts`'s writeSolarWindResult writes a
    // *non-null* object whose fields are null, and the slow tier does the
    // same. The card gate used to ask `data !== null`, so it could never see
    // this case and reported `ok` with an empty card for the whole outage.
    const state = fullPollerState();
    state.solarWind = {
      data: { kpCurrent: null, rtswPlasma: null, fetchedAt: NOW.toISOString() },
      fetchedAt: NOW.toISOString(),
      healthy: false,
    };
    state.spaceWeatherForecast = {
      data: { kpObserved: null, kpForecast: null, solarWind: null, fetchedAt: NOW.toISOString() },
      fetchedAt: NOW.toISOString(),
      healthy: false,
    };

    const brief = buildBrief(state, 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.spaceWeather.status).toBe('unavailable');
    expect(brief.spaceWeather.data).toBeNull();
    // Still only its own card.
    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.iss.status).toBe('ok');
  });

  it('keeps the card available when SWPC is stale but still carries a reading', () => {
    // API_SOURCES.md's SWPC fallback: "use last cached value with an aged
    // freshness stamp". A preserved reading is unhealthy but real, so the
    // card must stay available — which is why availability is decided on
    // content rather than on the `healthy` flag.
    const state = fullPollerState();
    state.solarWind = { ...state.solarWind, healthy: false };
    state.spaceWeatherForecast = { ...state.spaceWeatherForecast, healthy: false };

    const brief = buildBrief(state, 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.spaceWeather.status).toBe('ok');
    expect(brief.spaceWeather.data).not.toBeNull();
    // ...and the staleness is still reported, so the client can show it.
    expect(brief.spaceWeather.data?.solarLine.live.healthy).toBe(false);
    expect(brief.spaceWeather.data?.solarLine.forecast.healthy).toBe(false);
  });

  it('partial-outage case: ISS store down but next-pass fetched — ISS card still resolves', () => {
    const state = fullPollerState();
    state.iss = empty();
    const visualPasses: N2yoVisualPassesData = {
      satId: 25544,
      satName: 'ISS',
      passes: [
        {
          startAzimuth: 10,
          startAzimuthCompass: 'N',
          startElevation: 10,
          startUtc: NOW_SECONDS + 500,
          maxAzimuth: 90,
          maxAzimuthCompass: 'E',
          maxElevation: 45,
          maxUtc: NOW_SECONDS + 600,
          endAzimuth: 180,
          endAzimuthCompass: 'S',
          endElevation: 10,
          endUtc: NOW_SECONDS + 700,
          magnitude: -2.5,
          duration: 200,
        },
      ],
      fetchedAt: NOW.toISOString(),
    };

    const brief = buildBrief(state, 45, -75, NOW, visualPasses, NEUTRAL_HISTORY);

    expect(brief.iss.status).toBe('ok');
    expect(brief.iss.data?.position).toBeNull();
    expect(brief.iss.data?.nextPass).not.toBeNull();
  });

  it('partial-outage case: NeoWs down but GIBS still resolves the imagery half of its card', () => {
    const state = fullPollerState();
    state.neows = empty();

    const brief = buildBrief(state, 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.neoImagery.status).toBe('ok');
    expect(brief.neoImagery.data?.neo).toBeNull();
    expect(brief.neoImagery.data?.imagery).not.toBeNull();
  });

  it('total-outage case: the Brief still renders because Sky Anchor never fails', () => {
    const brief = buildBrief(emptyPollerState(), 45, -75, NOW, NO_VISUAL_PASSES, NEUTRAL_HISTORY);

    expect(brief.status).toBe('ok');
    expect(brief.skyAnchor.status).toBe('ok');
    expect(brief.skyAnchor.data).not.toBeNull();
    expect(brief.skyAnchor.data?.jupiter).toBeNull();
    expect(brief.skyAnchor.data?.venus).toBeNull();
    expect(brief.skyAnchor.data?.mars).toBeNull();
    expect(brief.skyAnchor.data?.saturn).toBeNull();
    expect(brief.skyAnchor.data?.mercury).toBeNull();
    expect(brief.iss.status).toBe('unavailable');
    expect(brief.spaceWeather.status).toBe('unavailable');
    expect(brief.spaceWeather.data).toBeNull();
    expect(brief.neoImagery.status).toBe('unavailable');
    expect(brief.learningMoment.length).toBeGreaterThan(0);
  });
});
