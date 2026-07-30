import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildSatellitesPayload, type SatellitesPayload } from './satellites.js';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { resetStore, setSourceState } from '../poller/store.js';
import type { CelestrakTleData } from '../clients/celestrak/index.js';

// Never connects: this route doesn't touch the DB, and Prisma only opens a
// connection on first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

const issRecord = {
  name: 'ISS (ZARYA)',
  noradCatId: 25544,
  line1: '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
  line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
};

const calsphereRecord = {
  name: 'CALSPHERE 1',
  noradCatId: 900,
  line1: '1 00900U 64063C   26195.50000000  .00000023  00000-0  35000-4 0  9995',
  line2: '2 00900  90.1600 200.0000 0025000 100.0000 260.0000 13.74000000123457',
};

const satellitesSuccess: CelestrakTleData = {
  records: [issRecord, calsphereRecord],
  fetchedAt: '2026-07-24T12:00:00.000Z',
};

describe('buildSatellitesPayload', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns an empty, unhealthy payload on a fresh store', () => {
    const payload = buildSatellitesPayload();

    expect(payload).toEqual({ satellites: [], fetchedAt: null, healthy: false });
  });

  it('maps stored TLE records to SatelliteElementSet, excluding the ISS', () => {
    setSourceState('satellites', satellitesSuccess, satellitesSuccess.fetchedAt, true);

    const payload = buildSatellitesPayload();

    expect(payload.healthy).toBe(true);
    expect(payload.fetchedAt).toBe(satellitesSuccess.fetchedAt);
    expect(payload.satellites).toEqual([
      {
        id: '900',
        name: 'CALSPHERE 1',
        line1: calsphereRecord.line1,
        line2: calsphereRecord.line2,
      },
    ]);
    expect(payload.satellites.some((s) => s.id === '25544')).toBe(false);
  });

  it('reflects unhealthy state while still serving stale-but-cached data', () => {
    setSourceState('satellites', satellitesSuccess, satellitesSuccess.fetchedAt, false);

    const payload = buildSatellitesPayload();

    expect(payload.healthy).toBe(false);
    expect(payload.satellites).toHaveLength(1);
  });

  it('returns an empty list (not a crash) when records is null', () => {
    setSourceState('satellites', { records: null, fetchedAt: 't' }, 't', false);

    const payload = buildSatellitesPayload();

    expect(payload).toEqual({ satellites: [], fetchedAt: 't', healthy: false });
  });
});

describe('GET /api/satellites', () => {
  beforeEach(() => {
    resetStore();
  });

  it('responds 200 with the satellites payload shape', async () => {
    setSourceState('satellites', satellitesSuccess, satellitesSuccess.fetchedAt, true);

    const res = await request(
      createApp({
        n2yoApiKey: 'TEST_KEY',
        prisma,
      }),
    ).get('/api/satellites');
    const body = res.body as SatellitesPayload;

    expect(res.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.satellites).toHaveLength(1);
    expect(body.satellites[0]!.name).toBe('CALSPHERE 1');
  });
});
