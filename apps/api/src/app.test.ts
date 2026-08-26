import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, buildCorsAllowedOrigins } from './app.js';
import { createPrismaClient } from './db/client.js';

// Never connects: these tests exercise CORS behavior, which happens
// before any route touches the DB, and Prisma only opens a connection on
// first query.
const prisma = createPrismaClient('postgresql://unused:unused@db.invalid:5432/unused');

const PROD_ORIGIN = 'https://astranet.example.com';
const DEV_ORIGIN = 'http://localhost:5173';

describe('buildCorsAllowedOrigins', () => {
  it('always allows the real web origin', () => {
    expect(buildCorsAllowedOrigins(PROD_ORIGIN, 'production')).toContain(PROD_ORIGIN);
  });

  it('additionally allows the Vite dev-server origin outside production', () => {
    expect(buildCorsAllowedOrigins(PROD_ORIGIN, 'development')).toEqual(
      expect.arrayContaining([PROD_ORIGIN, DEV_ORIGIN]),
    );
  });

  it('additionally allows the Vite dev-server origin when nodeEnv is undefined', () => {
    expect(buildCorsAllowedOrigins(PROD_ORIGIN, undefined)).toEqual(
      expect.arrayContaining([PROD_ORIGIN, DEV_ORIGIN]),
    );
  });

  it('excludes the dev-server origin in production', () => {
    expect(buildCorsAllowedOrigins(PROD_ORIGIN, 'production')).not.toContain(DEV_ORIGIN);
  });

  it('never returns a wildcard entry', () => {
    const all = [
      ...buildCorsAllowedOrigins(PROD_ORIGIN, 'production'),
      ...buildCorsAllowedOrigins(PROD_ORIGIN, 'development'),
    ];
    expect(all).not.toContain('*');
  });

  it('does not duplicate the entry when the web origin is itself the dev origin', () => {
    expect(buildCorsAllowedOrigins(DEV_ORIGIN, 'development')).toEqual([DEV_ORIGIN]);
  });
});

describe('CORS middleware (ARCHITECTURE.md §9 — cross-origin frontend/backend)', () => {
  it('reflects the configured web origin, not a wildcard, when it matches the request Origin', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      webOrigin: PROD_ORIGIN,
      nodeEnv: 'production',
    });

    const res = await request(app).get('/health').set('Origin', PROD_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(PROD_ORIGIN);
  });

  it('allows the Vite dev-server origin outside production even when webOrigin is a different, real production origin', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      webOrigin: PROD_ORIGIN,
      nodeEnv: 'development',
    });

    const res = await request(app).get('/health').set('Origin', DEV_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(DEV_ORIGIN);
  });

  it('rejects the Vite dev-server origin in production — no CORS header granted', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      webOrigin: PROD_ORIGIN,
      nodeEnv: 'production',
    });

    const res = await request(app).get('/health').set('Origin', DEV_ORIGIN);

    expect(res.status).toBe(200); // request still succeeds server-side; a real browser would block reading the response
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('grants no CORS header at all to an origin outside the allowlist', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      webOrigin: PROD_ORIGIN,
      nodeEnv: 'production',
    });

    const res = await request(app).get('/health').set('Origin', 'https://not-astranet.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never grants a wildcard origin', async () => {
    const app = createApp({
      n2yoApiKey: 'TEST_KEY',
      prisma,
      webOrigin: PROD_ORIGIN,
      nodeEnv: 'production',
    });

    const res = await request(app).get('/health').set('Origin', PROD_ORIGIN);

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('defaults to allowing only the dev-server origin when webOrigin/nodeEnv are omitted (test/dev convenience)', async () => {
    const app = createApp({ n2yoApiKey: 'TEST_KEY', prisma });

    const res = await request(app).get('/health').set('Origin', DEV_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(DEV_ORIGIN);
  });
});
