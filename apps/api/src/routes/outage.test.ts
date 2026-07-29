/**
 * End-to-end outage / degradation verification (WORKPLAN.md Phase 12,
 * ARCHITECTURE.md §5).
 *
 * Every other resilience test in this repo injects failure at a *seam*: the
 * client tests stub `fetch` but stop at the client's return value, and the
 * poller and `build-brief` tests stub the client functions themselves. Both
 * are useful, and both assume the layer beneath them behaves. This file
 * assumes nothing: it injects at the **transport boundary** — the real
 * `fetch` — and then drives the real clients, the real poller tick, the real
 * store and the real Express route, asserting on the HTTP response a browser
 * would actually receive.
 *
 * That is what makes it a *verification* of the degradation contract rather
 * than a restatement of it. A regression anywhere in that chain — a client
 * that starts throwing instead of returning null-data, a poller write that
 * stops isolating, a composition step that propagates one card's failure —
 * surfaces here and nowhere else.
 *
 * **Failure modes.** Each source is driven through 5xx, 4xx, malformed body
 * and a network abort. The abort case stands in for a timeout deliberately:
 * `fetchWithRetry`'s real `AbortController` fires at 10s and retries three
 * times, so an honest wall-clock timeout test would take ~30s per source. An
 * `AbortError` rejection is precisely what that timer produces, so injecting
 * it exercises the identical code path in milliseconds. The 10s/3-attempt
 * timer itself is covered in the client suites.
 *
 * **Retry cost is real here.** 5xx and network failures retry three times
 * with 500ms/1000ms backoff, so a failing source costs ~1.5s of real time.
 * The tick's `Promise.allSettled` runs sources in parallel, so a whole
 * degraded tick still lands near that figure rather than the sum.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { getAllSourceStates, resetStore } from '../poller/store.js';
import { runFastTierTick } from '../poller/fast-tier.js';
import { runSlowTierTick } from '../poller/slow-tier.js';
import { fetchN2yoPositions, fetchN2yoVisualPasses } from '../clients/n2yo/index.js';
import { fetchSwpcFast, fetchSwpcSlow } from '../clients/swpc/index.js';
import { fetchNasaDonki, fetchNasaNeows } from '../clients/nasa/index.js';
import { fetchHorizons, fetchHorizonsRaDec } from '../clients/jpl-horizons/index.js';
import { fetchCelestrakTle } from '../clients/celestrak/index.js';
import { fetchOpenMeteoBatch } from '../clients/open-meteo/index.js';
import type { DailyBrief } from '../brief/build-brief.js';

import n2yoPositions from '../clients/n2yo/__fixtures__/n2yo_positions.json';
import n2yoPasses from '../clients/n2yo/__fixtures__/n2yo_visualpasses.json';
import kp1m from '../clients/swpc/__fixtures__/kp_1m.json';
import rtswPlasma from '../clients/swpc/__fixtures__/rtsw_plasma.json';
import kpObserved from '../clients/swpc/__fixtures__/kp_observed.json';
import kpForecast from '../clients/swpc/__fixtures__/kp_forecast.json';
import solarWind from '../clients/swpc/__fixtures__/solar_wind.json';
import donkiCme from '../clients/nasa/__fixtures__/donki_cme.json';
import donkiFlr from '../clients/nasa/__fixtures__/donki_flr.json';
import neowsFeed from '../clients/nasa/__fixtures__/neows_feed.json';
import horizonsSun from '../clients/jpl-horizons/__fixtures__/jpl_horizons.json';
import horizonsRaDec from '../clients/jpl-horizons/__fixtures__/jpl_horizons_jupiter_csv.json';
import openMeteo from '../clients/open-meteo/__fixtures__/open_meteo.json';

const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');
const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';
const N2YO_KEY = 'TEST_KEY';
const NOW = new Date('2026-07-17T21:40:00.000Z');
const OBSERVER = { lat: 51.5072, lon: -0.1276 };

/** Every upstream this app talks to, keyed the way the failure injector matches them. */
type SourceId =
  'n2yo' | 'swpc' | 'nasaDonki' | 'nasaNeows' | 'horizons' | 'celestrak' | 'openMeteo';

type FailureMode = 'http500' | 'http503' | 'http404' | 'malformed' | 'abort';

const TLE_BODY = [
  'ISS (ZARYA)',
  '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
  '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
].join('\n');

/** Which source a URL belongs to — the same discrimination a proxy would make. */
function sourceOf(url: string): SourceId | null {
  if (url.includes('api.n2yo.com')) return 'n2yo';
  if (url.includes('services.swpc.noaa.gov')) return 'swpc';
  if (url.includes('api.nasa.gov/DONKI')) return 'nasaDonki';
  if (url.includes('api.nasa.gov/neo')) return 'nasaNeows';
  if (url.includes('ssd.jpl.nasa.gov')) return 'horizons';
  if (url.includes('celestrak.org')) return 'celestrak';
  if (url.includes('api.open-meteo.com')) return 'openMeteo';
  return null;
}

/** The healthy payload each endpoint would return. */
function successBody(url: string): { json: unknown } | { text: string } {
  if (url.includes('/positions/')) return { json: n2yoPositions };
  if (url.includes('/visualpasses/')) return { json: n2yoPasses };
  if (url.includes('planetary_k_index_1m.json')) return { json: kp1m };
  if (url.includes('/rtsw/')) return { json: rtswPlasma };
  if (url.includes('noaa-planetary-k-index-forecast.json')) return { json: kpForecast };
  if (url.includes('noaa-planetary-k-index.json')) return { json: kpObserved };
  if (url.includes('propagated-solar-wind')) return { json: solarWind };
  if (url.includes('/DONKI/CME')) return { json: donkiCme };
  if (url.includes('/DONKI/FLR')) return { json: donkiFlr };
  if (url.includes('api.nasa.gov/neo')) return { json: neowsFeed };
  if (url.includes('ssd.jpl.nasa.gov')) {
    // The planet calls request CSV_FORMAT; the Sun call does not.
    return { json: url.includes('CSV_FORMAT') ? horizonsRaDec : horizonsSun };
  }
  if (url.includes('celestrak.org')) {
    return url.includes('FORMAT=tle') ? { text: TLE_BODY } : { json: [] };
  }
  if (url.includes('api.open-meteo.com')) return { json: openMeteo };
  throw new Error(`outage.test: no fixture wired for ${url}`);
}

function okResponse(url: string): Response {
  const body = successBody(url);
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve('json' in body ? body.json : undefined),
    text: () =>
      Promise.resolve(
        'text' in body ? body.text : JSON.stringify((body as { json: unknown }).json),
      ),
  } as unknown as Response;
}

function failedResponse(mode: FailureMode, url: string): Response | Promise<never> {
  switch (mode) {
    case 'http500':
    case 'http503':
      return {
        ok: false,
        status: mode === 'http500' ? 500 : 503,
        json: () => Promise.reject(new Error('no body')),
        text: () => Promise.resolve(''),
      } as unknown as Response;
    case 'http404':
      return {
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('no body')),
        text: () => Promise.resolve(''),
      } as unknown as Response;
    case 'malformed':
      // Responds 200 with a body that is not what the schema expects — the
      // case a status-code-only guard would sail straight past.
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ unexpected: 'shape', not: [url] }),
        text: () => Promise.resolve('<html>gateway</html>'),
      } as unknown as Response;
    case 'abort': {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
  }
}

/** Installs a `fetch` that fails exactly the named sources and serves the rest. */
function injectFailures(failing: Partial<Record<SourceId, FailureMode>>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const source = sourceOf(url);
      if (source === null) throw new Error(`outage.test: unrouted URL ${url}`);
      const mode = failing[source];
      if (mode === undefined) return Promise.resolve(okResponse(url));
      const result = failedResponse(mode, url);
      return result instanceof Promise ? result : Promise.resolve(result);
    }),
  );
}

const fastClients = { fetchN2yoPositions, fetchSwpcFast, n2yoApiKey: N2YO_KEY };
const slowClients = {
  fetchNasaDonki,
  fetchNasaNeows,
  fetchHorizons,
  fetchHorizonsRaDec,
  fetchSwpcSlow,
  fetchCelestrakTle,
  nasaApiKey: 'TEST_NASA_KEY',
};

/** Runs both real poller tiers against whatever `fetch` is currently stubbed. */
async function pollBothTiers(): Promise<void> {
  await runFastTierTick(fastClients, NOW);
  await runSlowTierTick(slowClients, NOW);
}

function appUnderTest() {
  return createApp({
    n2yoApiKey: N2YO_KEY,
    prisma,
    jwtAccessSecret: JWT_ACCESS_SECRET,
    // The real client, so the route's own N2YO call goes through the same
    // injected transport as the poller's.
    fetchN2yoVisualPasses,
    fetchOpenMeteoBatch,
    bortleAt: () => 4,
  });
}

/** The Brief route response, typed — supertest hands back `any` otherwise. */
async function getBrief(): Promise<{ status: number; body: DailyBrief }> {
  const res = await request(appUnderTest()).get(
    `/api/brief?lat=${OBSERVER.lat}&lon=${OBSERVER.lon}`,
  );
  return { status: res.status, body: res.body as DailyBrief };
}

/** The Best-Spot response, narrowed to the fields these tests assert on. */
interface BestSpotBody {
  ranking: { basis: string };
  sites: unknown[];
}

async function getBestSpot(): Promise<{ status: number; body: BestSpotBody }> {
  const res = await request(appUnderTest()).get(
    `/api/best-spot?lat=${OBSERVER.lat}&lon=${OBSERVER.lon}`,
  );
  return { status: res.status, body: res.body as BestSpotBody };
}

beforeEach(() => {
  resetStore();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('baseline — every source healthy', () => {
  it('resolves all four Brief cards, so degraded assertions cannot pass vacuously', async () => {
    injectFailures({});
    await pollBothTiers();

    const res = await getBrief();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.skyAnchor.status).toBe('ok');
    expect(res.body.iss.status).toBe('ok');
    expect(res.body.spaceWeather.status).toBe('ok');
    expect(res.body.neoImagery.status).toBe('ok');
  });

  it('marks every polled source healthy in the store', async () => {
    injectFailures({});
    await pollBothTiers();

    const state = getAllSourceStates();
    for (const key of ['iss', 'solarWind', 'donki', 'neows', 'horizons', 'satellites'] as const) {
      expect(state[key].healthy, `${key} should be healthy`).toBe(true);
    }
  });
});

describe.each<FailureMode>(['http500', 'http503', 'http404', 'malformed', 'abort'])(
  'per-source outage (%s)',
  (mode) => {
    it('N2YO down blanks only the ISS card', async () => {
      injectFailures({ n2yo: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.iss.status).toBe('unavailable');
      // Priority order (ARCHITECTURE.md §5) — everything else survives.
      expect(res.body.skyAnchor.status).toBe('ok');
      expect(res.body.spaceWeather.status).toBe('ok');
      expect(res.body.neoImagery.status).toBe('ok');
      expect(res.body.status).toBe('ok');
    });

    it('KNOWN GAP: SWPC down leaves the card "ok" instead of "unavailable"', async () => {
      // Pins a real defect rather than asserting the contract — see
      // DECISIONS.md 2026-07-29. `build-brief.ts` gates this card on
      // `solarWind.data !== null`, but the fast tier's total-failure path
      // writes a non-null object whose *fields* are null, so the gate can
      // never open. The `healthy: false` flag ARCHITECTURE.md §5 says should
      // drive degradation is not consulted at the card level.
      //
      // Isolation itself is intact — no other card is touched — which is why
      // this is a status-signalling defect, not a cascade.
      injectFailures({ swpc: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.spaceWeather.status).toBe('ok');
      // The contents are honestly empty and the nested health flags are
      // false, so the data layer is not lying — only the card's own status is.
      const card = res.body.spaceWeather.data!;
      expect(card.solarLine.headline).toBe('space weather unavailable');
      expect(card.solarLine.live.healthy).toBe(false);
      expect(card.solarLine.live.kp).toBeNull();
      expect(card.aurora).toBeNull();

      expect(res.body.skyAnchor.status).toBe('ok');
      expect(res.body.iss.status).toBe('ok');
      expect(res.body.neoImagery.status).toBe('ok');
    });

    it('KNOWN GAP: the store marks SWPC unhealthy, so the signal exists but is unused', async () => {
      // The information the card needs is present and correct one layer down.
      injectFailures({ swpc: mode });
      await pollBothTiers();

      const state = getAllSourceStates();
      expect(state.solarWind.healthy).toBe(false);
      expect(state.spaceWeatherForecast.healthy).toBe(false);
      // ...but non-null, which is exactly why the card's null-check misses it.
      expect(state.solarWind.data).not.toBeNull();
    });

    it('NASA NeoWs down leaves the NEO half unavailable without touching other cards', async () => {
      injectFailures({ nasaNeows: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.neoImagery.data?.neo ?? null).toBeNull();
      expect(res.body.neoImagery.status).toBe('ok');
      expect(res.body.skyAnchor.status).toBe('ok');
      expect(res.body.iss.status).toBe('ok');
      expect(res.body.spaceWeather.status).toBe('ok');
    });

    it('NASA DONKI down leaves space weather resolved but unrated', async () => {
      // DONKI drives the causal/confidence half only. Kp still comes from
      // SWPC, so the card must survive — Part VII's "never state a forecast
      // without its confidence" is then satisfied structurally by a null
      // confidence, not by blanking the card.
      injectFailures({ nasaDonki: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.spaceWeather.status).toBe('ok');
      expect(res.body.spaceWeather.data?.aurora?.confidence ?? null).toBeNull();
      expect(res.body.skyAnchor.status).toBe('ok');
      expect(res.body.iss.status).toBe('ok');
    });

    it('JPL Horizons down leaves Sky Anchor resolved with null planets', async () => {
      // Sky Anchor is the always-works card: Sun and Moon are pure math, so
      // only the ephemeris-backed planet fields may go null.
      injectFailures({ horizons: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.skyAnchor.status).toBe('ok');
      const anchor = res.body.skyAnchor.data!;
      expect(typeof anchor.sunAltitudeDeg).toBe('number');
      expect(anchor.moon).not.toBeNull();
      expect(anchor.jupiter).toBeNull();
      expect(res.body.iss.status).toBe('ok');
      expect(res.body.spaceWeather.status).toBe('ok');
    });

    it('CelesTrak down does not affect the Brief at all', async () => {
      // CelesTrak feeds /explore's satellite population, not the Brief.
      injectFailures({ celestrak: mode });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(getAllSourceStates().satellites.healthy).toBe(false);
    });

    it('Open-Meteo down degrades Best-Spot to darkness+travel, still 200', async () => {
      injectFailures({ openMeteo: mode });
      await pollBothTiers();

      const res = await getBestSpot();
      expect(res.status).toBe(200);
      expect(res.body.ranking.basis).toBe('darkness-travel');
      expect(res.body.sites.length).toBeGreaterThan(0);
    });

    it('every upstream down at once still serves a Brief on Sky Anchor alone', async () => {
      // ARCHITECTURE.md §5: "The Brief renders if any card resolves", and
      // Sky Anchor is pure math with no source to fail.
      injectFailures({
        n2yo: mode,
        swpc: mode,
        nasaDonki: mode,
        nasaNeows: mode,
        horizons: mode,
        celestrak: mode,
        openMeteo: mode,
      });
      await pollBothTiers();

      const res = await getBrief();
      expect(res.status).toBe(200);
      expect(res.body.skyAnchor.status).toBe('ok');
      expect(res.body.skyAnchor.data).not.toBeNull();
      expect(res.body.iss.status).toBe('unavailable');
      expect(typeof res.body.learningMoment).toBe('string');

      // Space weather carries the same KNOWN GAP as the single-source case
      // above: 'ok' with empty contents rather than 'unavailable'. Asserted
      // here too so a fix has to update both sites deliberately.
      expect(res.body.spaceWeather.status).toBe('ok');
      expect(res.body.spaceWeather.data?.aurora ?? null).toBeNull();
    });
  },
);

describe('outage does not corrupt the store', () => {
  it('keeps the last known-good value for sources whose fallback says to', async () => {
    // API_SOURCES.md gives per-source fallbacks; SWPC/DONKI/Horizons/CelesTrak
    // preserve their last value, N2YO and NeoWs do not. Verified through the
    // real transport rather than by stubbing the client's return.
    injectFailures({});
    await pollBothTiers();
    const healthy = getAllSourceStates();
    expect(healthy.solarWind.data).not.toBeNull();

    injectFailures({ swpc: 'http500', n2yo: 'http500', nasaNeows: 'http500' });
    await pollBothTiers();
    const degraded = getAllSourceStates();

    // Preserved, but never mislabeled as fresh.
    expect(degraded.solarWind.data).not.toBeNull();
    expect(degraded.solarWind.healthy).toBe(false);

    // Not preserved — matches "position unavailable" / "unavailable".
    expect(degraded.iss.data?.positions ?? null).toBeNull();
    expect(degraded.iss.healthy).toBe(false);
    expect(degraded.neows.healthy).toBe(false);
  });

  it('recovers cleanly once the source comes back', async () => {
    injectFailures({ n2yo: 'http500', swpc: 'abort' });
    await pollBothTiers();
    expect(getAllSourceStates().iss.healthy).toBe(false);

    injectFailures({});
    await pollBothTiers();

    const state = getAllSourceStates();
    expect(state.iss.healthy).toBe(true);
    expect(state.solarWind.healthy).toBe(true);

    const res = await getBrief();
    expect(res.body.iss.status).toBe('ok');
    expect(res.body.spaceWeather.status).toBe('ok');
  });
});

describe('a 4xx is not retried, a 5xx is', () => {
  it('spends one attempt on 404 and three on 500', async () => {
    // Directly relevant to the rate-limit budget: a failing source costs up
    // to 3x its nominal request count, which is what makes retry
    // amplification a real consideration for N2YO's per-endpoint limit.
    injectFailures({ n2yo: 'http404' });
    await runFastTierTick(fastClients, NOW);
    const notRetried = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;

    resetStore();
    injectFailures({ n2yo: 'http500' });
    await runFastTierTick(fastClients, NOW);
    const retried = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;

    // The fast tick makes 1 N2YO call + 2 SWPC calls; only N2YO is failing.
    expect(notRetried).toBe(3);
    expect(retried).toBe(5);
  });
});
