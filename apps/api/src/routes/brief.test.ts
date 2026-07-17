import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetStore, setSourceState } from '../poller/store.js';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';
import type { DailyBrief } from '../brief/build-brief.js';

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const visualPassesSuccess: N2yoVisualPassesData = {
  satId: 25544,
  satName: 'ISS (ZARYA)',
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
  fetchedAt: new Date().toISOString(),
};

describe('GET /api/brief', () => {
  beforeEach(() => {
    resetStore();
  });

  it('400s when lat/lon are missing', async () => {
    const app = createApp({ n2yoApiKey: 'TEST_KEY' });
    const res = await request(app).get('/api/brief');
    expect(res.status).toBe(400);
  });

  it('400s when lat/lon are out of range', async () => {
    const app = createApp({ n2yoApiKey: 'TEST_KEY' });
    const res = await request(app).get('/api/brief?lat=999&lon=45');
    expect(res.status).toBe(400);
  });

  it('200s with a resolved Brief for valid coordinates, including a live-fetched next pass', async () => {
    const fetchN2yoVisualPasses = vi.fn().mockResolvedValue(visualPassesSuccess);
    const app = createApp({ n2yoApiKey: 'TEST_KEY', fetchN2yoVisualPasses });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.observer).toEqual({ latDeg: 45, lonDeg: -75 });
    expect(body.skyAnchor.status).toBe('ok');
    expect(body.iss.data?.nextPass?.startUtc).toBe(NOW_SECONDS + 3600);
    expect(fetchN2yoVisualPasses).toHaveBeenCalledWith(
      expect.objectContaining({ satId: 25544, observerLat: 45, observerLng: -75 }),
      'TEST_KEY',
      expect.any(Date),
    );
  });

  it('still 200s and degrades only next-pass when that fetch rejects, leaving live ISS position intact', async () => {
    setSourceState(
      'iss',
      {
        satId: 25544,
        satName: 'ISS',
        positions: [
          {
            latitude: 1,
            longitude: 2,
            altitude: 420,
            azimuth: 0,
            elevation: 0,
            ra: 0,
            dec: 0,
            timestamp: NOW_SECONDS,
            eclipsed: false,
          },
        ],
        fetchedAt: 't',
      },
      't',
      true,
    );
    const fetchN2yoVisualPasses = vi.fn().mockRejectedValue(new Error('N2YO down'));
    const app = createApp({ n2yoApiKey: 'TEST_KEY', fetchN2yoVisualPasses });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.skyAnchor.status).toBe('ok');
    expect(body.iss.status).toBe('ok');
    expect(body.iss.data?.position?.latitude).toBe(1);
    expect(body.iss.data?.nextPass).toBeNull();
  });

  it('reflects live poller state in the response', async () => {
    setSourceState(
      'solarWind',
      {
        kpCurrent: { timeTag: 't', kpIndex: 3, estimatedKp: 3.33, kpCode: '3P' },
        rtswPlasma: {
          timeTag: 't',
          source: 'DSCOVR',
          protonSpeed: 450,
          protonDensity: 5,
          protonTemperature: 100000,
          overallQuality: 0,
        },
        fetchedAt: 't',
      },
      't',
      true,
    );

    const fetchN2yoVisualPasses = vi.fn().mockResolvedValue(visualPassesSuccess);
    const app = createApp({ n2yoApiKey: 'TEST_KEY', fetchN2yoVisualPasses });

    const res = await request(app).get('/api/brief?lat=45&lon=-75');
    const body = res.body as DailyBrief;

    expect(body.spaceWeather.status).toBe('ok');
    expect(body.spaceWeather.data?.solarLine.live.speedKmS).toBe(450);
  });
});
