import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildHealthPayload, type HealthPayload } from './health.js';
import { createApp } from '../app.js';
import { resetStore, setSourceState } from '../poller/store.js';

const NOW = new Date('2026-07-17T12:00:00.000Z');

describe('buildHealthPayload', () => {
  beforeEach(() => {
    resetStore();
  });

  it('reports status ok with every source unhealthy/empty on a fresh store', () => {
    const payload = buildHealthPayload(NOW);

    expect(payload.status).toBe('ok');
    expect(payload.checkedAt).toBe(NOW.toISOString());
    expect(payload.sources).toEqual({
      iss: { healthy: false, fetchedAt: null },
      solarWind: { healthy: false, fetchedAt: null },
      spaceWeatherForecast: { healthy: false, fetchedAt: null },
      donki: { healthy: false, fetchedAt: null },
      neows: { healthy: false, fetchedAt: null },
      gibs: { healthy: false, fetchedAt: null },
      horizons: { healthy: false, fetchedAt: null },
    });
  });

  it('reflects per-source health flags from the store', () => {
    setSourceState(
      'iss',
      { satId: 25544, satName: 'ISS', positions: null, fetchedAt: 't' },
      't',
      true,
    );
    setSourceState('solarWind', { kpCurrent: null, rtswPlasma: null, fetchedAt: 't' }, 't', false);

    const payload = buildHealthPayload(NOW);

    expect(payload.sources.iss).toEqual({ healthy: true, fetchedAt: 't' });
    expect(payload.sources.solarWind).toEqual({ healthy: false, fetchedAt: 't' });
  });

  it('reports status ok even when every source is unhealthy (liveness, not readiness)', () => {
    setSourceState(
      'iss',
      { satId: 25544, satName: 'Unknown', positions: null, fetchedAt: 't' },
      't',
      false,
    );

    const payload = buildHealthPayload(NOW);

    expect(payload.status).toBe('ok');
  });
});

describe('GET /health', () => {
  beforeEach(() => {
    resetStore();
  });

  it('responds 200 with the health payload shape', async () => {
    setSourceState('donki', { cmes: [], flares: [], fetchedAt: 't' }, 't', true);

    const res = await request(createApp({ n2yoApiKey: 'TEST_KEY' })).get('/health');
    const body = res.body as HealthPayload;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.sources.donki).toEqual({ healthy: true, fetchedAt: 't' });
  });
});
