import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildFastTierStreamPayload, formatSseEvent, registerStreamRoute } from './stream.js';
import { createApp } from '../app.js';
import { resetStore, setSourceState } from '../poller/store.js';
import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { SwpcFastData } from '../clients/swpc/index.js';

const NOW = new Date('2026-07-17T12:00:00.000Z');

const issData: N2yoPositionsData = {
  satId: 25544,
  satName: 'ISS (ZARYA)',
  positions: [
    {
      latitude: 1,
      longitude: 2,
      altitude: 420,
      azimuth: 0,
      elevation: 0,
      ra: 0,
      dec: 0,
      timestamp: 1,
      eclipsed: false,
    },
  ],
  fetchedAt: 't-iss',
};

const swpcData: SwpcFastData = {
  kpCurrent: { timeTag: 't', kpIndex: 3, estimatedKp: 3, kpCode: '3P' },
  rtswPlasma: null,
  fetchedAt: 't-swpc',
};

describe('buildFastTierStreamPayload', () => {
  beforeEach(() => {
    resetStore();
  });

  it('includes only iss and solarWind, each with its own store fetchedAt/healthy', () => {
    setSourceState('iss', issData, 't-iss', true);
    setSourceState('solarWind', swpcData, 't-swpc', true);
    setSourceState('donki', { cmes: [], flares: [], fetchedAt: 't' }, 't', true);

    const payload = buildFastTierStreamPayload(NOW);

    expect(payload).toEqual({
      iss: { data: issData, fetchedAt: 't-iss', healthy: true },
      solarWind: { data: swpcData, fetchedAt: 't-swpc', healthy: true },
      streamedAt: NOW.toISOString(),
    });
    expect(payload).not.toHaveProperty('donki');
  });

  it("does not conflate streamedAt with either source's own fetchedAt", () => {
    setSourceState('iss', issData, 't-iss', true);

    const payload = buildFastTierStreamPayload(NOW);

    expect(payload.streamedAt).toBe(NOW.toISOString());
    expect(payload.iss.fetchedAt).toBe('t-iss');
    expect(payload.streamedAt).not.toBe(payload.iss.fetchedAt);
  });
});

describe('formatSseEvent', () => {
  it('formats as a data: line followed by a blank line, per the SSE wire format', () => {
    const payload = buildFastTierStreamPayload(NOW);
    const event = formatSseEvent(payload);

    expect(event.startsWith('data: ')).toBe(true);
    expect(event.endsWith('\n\n')).toBe(true);
    expect(JSON.parse(event.slice('data: '.length, -2))).toEqual(payload);
  });
});

describe('GET /stream', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    resetStore();
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('responds with SSE headers and an immediate fast-tier payload', async () => {
    setSourceState('iss', issData, 't-iss', true);
    setSourceState('solarWind', swpcData, 't-swpc', true);
    setSourceState('donki', { cmes: [], flares: [], fetchedAt: 't' }, 't', true);

    const { contentType, chunk } = await new Promise<{
      contentType: string | undefined;
      chunk: string;
    }>((resolve, reject) => {
      const req = http.get(`http://localhost:${String(port)}/stream`, (res) => {
        res.on('data', (data: Buffer) => {
          resolve({ contentType: res.headers['content-type'], chunk: data.toString() });
          req.destroy();
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });

    expect(contentType).toBe('text/event-stream');
    expect(chunk.startsWith('data: ')).toBe(true);

    const parsed = JSON.parse(chunk.slice('data: '.length).trim()) as {
      iss: unknown;
      solarWind: unknown;
    };
    expect(parsed.iss).toEqual({ data: issData, fetchedAt: 't-iss', healthy: true });
    expect(parsed.solarWind).toEqual({ data: swpcData, fetchedAt: 't-swpc', healthy: true });
    expect(Object.keys(parsed)).not.toContain('donki');
  });

  it('pushes a second event on the configured interval without a new fetch (heartbeat)', async () => {
    setSourceState('iss', issData, 't-iss', true);

    // A short override interval, not STREAM_PUSH_INTERVAL_MS's real 5s cadence,
    // so the test observes a second push without waiting out production timing.
    const heartbeatApp = express();
    registerStreamRoute(heartbeatApp, 50);
    const heartbeatServer = http.createServer(heartbeatApp);
    await new Promise<void>((resolve) => heartbeatServer.listen(0, resolve));
    const heartbeatPort = (heartbeatServer.address() as AddressInfo).port;

    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`http://localhost:${String(heartbeatPort)}/stream`, (res) => {
        res.on('data', (data: Buffer) => {
          chunks.push(data.toString());
          if (chunks.length === 2) {
            req.destroy();
            resolve();
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
    await new Promise<void>((resolve) => heartbeatServer.close(() => resolve()));

    expect(chunks).toHaveLength(2);
    const first = JSON.parse(chunks[0]?.slice('data: '.length).trim() ?? '{}') as {
      iss: { fetchedAt: string };
    };
    const second = JSON.parse(chunks[1]?.slice('data: '.length).trim() ?? '{}') as {
      iss: { fetchedAt: string };
    };
    expect(first.iss.fetchedAt).toBe('t-iss');
    expect(second.iss.fetchedAt).toBe('t-iss');
  });
});
