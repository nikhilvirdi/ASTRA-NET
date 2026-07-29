/**
 * `/api/share` end to end (WORKPLAN.md Phase 11).
 *
 * The Definition of Done is "a generated card opens for a logged-out
 * visitor and previews correctly when the link is shared", so the central
 * tests here send no credentials at all and assert against what a crawler
 * and an anonymous browser actually receive.
 *
 * Real Postgres, not a mocked Prisma: a share card's whole point is that it
 * outlives the request that made it, so a create that is never really
 * persisted would pass a mocked test and fail the phase.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';
import { signAccessToken } from '../auth/jwt.js';
import { resetStore, setSourceState } from '../poller/store.js';
import {
  ShareSnapshotSchema,
  SHARE_ID_PATTERN,
  type ShareSnapshot,
} from '../share/share.schemas.js';
import type { PrismaClient } from '@prisma/client';
import type { N2yoVisualPassesData } from '../clients/n2yo/index.js';

const JWT_ACCESS_SECRET = 'test-only-fake-jwt-secret-not-a-real-value';
const TEST_EMAIL_SUFFIX = '@share-route-test.invalid';

const LONDON = { lat: 51.5072, lon: -0.1276 };

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
    } catch {
      // No .env — the explicit check below produces the real error.
    }
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set and no repo-root .env was found — start the docker compose Postgres and set it before running these tests.',
    );
  }
  return url;
}

const prisma = createPrismaClient(loadDatabaseUrl());

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const visualPasses: N2yoVisualPassesData = {
  satId: 25544,
  satName: 'ISS (ZARYA)',
  passes: [
    {
      startAzimuth: 218,
      startAzimuthCompass: 'SW',
      startElevation: 10,
      startUtc: NOW_SECONDS + 3600,
      maxAzimuth: 142,
      maxAzimuthCompass: 'SE',
      maxElevation: 68.4,
      maxUtc: NOW_SECONDS + 3720,
      endAzimuth: 71,
      endAzimuthCompass: 'ENE',
      endElevation: 10,
      endUtc: NOW_SECONDS + 3840,
      magnitude: -3.2,
      duration: 240,
    },
  ],
  fetchedAt: new Date().toISOString(),
};

function appWith(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    n2yoApiKey: 'TEST_KEY',
    prisma,
    jwtAccessSecret: JWT_ACCESS_SECRET,
    fetchN2yoVisualPasses: vi.fn(() => Promise.resolve(visualPasses)),
    ...overrides,
  });
}

const createdIds: string[] = [];

/** The `POST /api/share` 201 body, as `CreateShareResponseSchema` defines it. */
interface CreatedCard {
  id: string;
  shareUrl: string;
  ogImageUrl: string;
  snapshot: ShareSnapshot;
}

/** Creates a card the way a real caller would, and registers it for cleanup. */
async function createCard(
  app = appWith(),
  body: Record<string, unknown> = LONDON,
  accessToken?: string,
): Promise<{ status: number; body: CreatedCard }> {
  const pending = request(app).post('/api/share').send(body);
  // `tryAuthenticate` reads `Authorization: Bearer`, not a cookie.
  if (accessToken !== undefined) void pending.set('Authorization', `Bearer ${accessToken}`);
  const res = await pending;
  const created = res.body as Partial<CreatedCard>;
  if (typeof created.id === 'string') createdIds.push(created.id);
  return { status: res.status, body: res.body as CreatedCard };
}

async function cleanup(): Promise<void> {
  if (createdIds.length > 0) {
    await prisma.shareCard.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
  // `POST /api/share` composes a Brief, and visual passes are now served
  // from the Cache table on a TTL. Every test here shares one observer
  // position, so without this a successful pass list written by an earlier
  // test is still live when a later test stubs N2YO as down.
  await prisma.cache.deleteMany({ where: { key: { startsWith: 'n2yo:visualpasses:' } } });
}

beforeEach(async () => {
  resetStore();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // A Sky Anchor card always resolves (pure math), which is what lets a
  // snapshot be built with no upstream source available at all.
  setSourceState(
    'spaceWeatherForecast',
    {
      kpObserved: null,
      kpForecast: [
        { timeTag: new Date().toISOString(), kp: 4, status: 'predicted', noaaScale: null },
      ],
      solarWind: null,
      fetchedAt: new Date().toISOString(),
    },
    new Date().toISOString(),
    true,
  );
  await cleanup();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await cleanup();
  await prisma.$disconnect();
});

describe('POST /api/share', () => {
  it('creates a card for an anonymous caller — no login required', async () => {
    const res = await createCard();

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(SHARE_ID_PATTERN);
    expect(ShareSnapshotSchema.safeParse(res.body.snapshot).success).toBe(true);
  });

  it('actually persists the row, not just the response', async () => {
    const res = await createCard();
    expect(await prisma.shareCard.count({ where: { id: res.body.id } })).toBe(1);
  });

  it('returns absolute URLs for both the page and the image', async () => {
    const res = await createCard();

    expect(res.body.shareUrl).toMatch(/^https?:\/\/[^/]+\/share\/[A-Za-z0-9_-]{12}$/);
    expect(res.body.ogImageUrl).toMatch(
      /^https?:\/\/[^/]+\/api\/share\/[A-Za-z0-9_-]{12}\/og\.png$/,
    );
  });

  it('honours configured origins for the web page and the API', async () => {
    const app = appWith({
      publicApiOrigin: 'https://api.astranet.example/',
      webOrigin: 'https://astranet.example/',
    });
    const res = await createCard(app);

    // Trailing slashes are normalised away rather than doubled.
    expect(res.body.shareUrl).toBe(`https://astranet.example/share/${res.body.id}`);
    expect(res.body.ogImageUrl).toBe(
      `https://api.astranet.example/api/share/${res.body.id}/og.png`,
    );
  });

  it('ties the card to the account when the caller is logged in', async () => {
    const user = await prisma.user.create({
      data: { email: `owner${Date.now()}${TEST_EMAIL_SUFFIX}` },
    });
    const token = await signAccessToken(user.id, JWT_ACCESS_SECRET, new Date());
    const res = await createCard(appWith(), LONDON, token);

    const row = await prisma.shareCard.findUnique({
      where: { id: res.body.id },
      select: { userId: true },
    });
    expect(row?.userId).toBe(user.id);
  });

  it('gives every card a distinct, unguessable id', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      ids.add((await createCard()).body.id);
    }
    expect(ids.size).toBe(5);
  });

  it('400s on missing, malformed or out-of-range coordinates', async () => {
    for (const body of [
      {},
      { lat: 51.5 },
      { lon: -0.12 },
      { lat: 'north', lon: 0 },
      { lat: 95, lon: 0 },
      { lat: 0, lon: 181 },
    ]) {
      expect((await createCard(appWith(), body)).status).toBe(400);
    }
  });

  it('rejects an unexpected field rather than silently dropping it', async () => {
    // The body schema is `.strict()`: a client-supplied headline must never
    // be accepted, because the card is a public claim this server makes.
    const res = await createCard(appWith(), { ...LONDON, headline: 'Aurora guaranteed!' });
    expect(res.status).toBe(400);
  });

  it('builds the snapshot from the server’s own Brief, never from the request', async () => {
    const res = await createCard();
    expect(res.body.snapshot).toMatchObject({
      observer: { latDeg: LONDON.lat, lonDeg: LONDON.lon },
    });
    expect(JSON.stringify(res.body.snapshot)).not.toContain('Aurora guaranteed');
  });

  it('still produces a card when every upstream source is down', async () => {
    resetStore();
    // The real client never throws and never resolves null — on an upstream
    // failure it resolves `passes: null`, so that is what is stubbed here.
    const res = await createCard(
      appWith({
        fetchN2yoVisualPasses: vi.fn(() =>
          Promise.resolve({
            satId: 25544,
            satName: 'Unknown',
            passes: null,
            fetchedAt: new Date().toISOString(),
          }),
        ),
      }),
    );

    expect(res.status).toBe(201);
    expect(ShareSnapshotSchema.safeParse(res.body.snapshot).success).toBe(true);
    // Honest about it rather than reading as though the sky were quiet.
    expect(res.body.snapshot).toMatchObject({ availability: { iss: 'unavailable' } });
  });
});

describe('GET /api/share/:id', () => {
  it('serves the snapshot to a logged-out visitor', async () => {
    const created = await createCard();
    const res = await request(appWith()).get(`/api/share/${created.body.id}`);

    expect(res.status).toBe(200);
    const served = ShareSnapshotSchema.parse(res.body);

    // Everything the card renders is a pre-formatted string, so all of it
    // must come back byte-identical to what the create returned.
    expect(served.id).toBe(created.body.id);
    expect(served.headline).toBe(created.body.snapshot.headline);
    expect(served.facts).toEqual(created.body.snapshot.facts);
    expect(served.observer.label).toBe(created.body.snapshot.observer.label);
    expect(served.sky.surfaceHex).toBe(created.body.snapshot.sky.surfaceHex);
    expect(served.availability).toEqual(created.body.snapshot.availability);
    // Markers: their rendered half is strings and must be exact; their
    // azimuth/altitude are raw floats and fall under the same limit below.
    expect(
      served.horizon.markers.map(({ id, label, sublabel, type }) => ({
        id,
        label,
        sublabel,
        type,
      })),
    ).toEqual(
      created.body.snapshot.horizon.markers.map(({ id, label, sublabel, type }) => ({
        id,
        label,
        sublabel,
        type,
      })),
    );
    served.horizon.markers.forEach((marker, i) => {
      const origin = created.body.snapshot.horizon.markers[i]!;
      expect(marker.azimuthDeg).toBeCloseTo(origin.azimuthDeg, 12);
      expect(marker.altitudeDeg).toBeCloseTo(origin.altitudeDeg, 12);
    });

    // Raw floats survive to 16 significant digits, not the full f64 — a
    // Prisma serialization limit characterised in `share/store.test.ts`.
    // It cannot affect the card, because none of it is rendered directly.
    expect(served.sky.twilightValue).toBeCloseTo(created.body.snapshot.sky.twilightValue, 12);
    expect(served.sky.sunAltitudeDeg).toBeCloseTo(created.body.snapshot.sky.sunAltitudeDeg, 12);
  });

  it('marks the response immutable so it can be cached indefinitely', async () => {
    const created = await createCard();
    const res = await request(appWith()).get(`/api/share/${created.body.id}`);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('404s for an id that does not exist', async () => {
    const res = await request(appWith()).get('/api/share/Zz9-_aB1cD2e');
    expect(res.status).toBe(404);
  });

  it('404s for a malformed id without querying the database', async () => {
    // An id that cannot exist is a 404, not a query. Asserted with an
    // injected stub rather than by spying on the shared client: a `vi.spyOn`
    // on a Prisma model method is not reliably restorable (the methods are
    // proxied), and leaves the real client broken for every later test.
    const findUnique = vi.fn();
    const stubPrisma = { shareCard: { findUnique } } as unknown as PrismaClient;
    const res = await request(appWith({ prisma: stubPrisma })).get(
      '/api/share/not-a-valid-id-at-all',
    );

    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('500s rather than 404s when a stored blob no longer parses', async () => {
    // "This card does not exist" and "this card exists but cannot be read"
    // are different bugs; disguising the second as the first hides it.
    const id = 'Corrupt1Row2';
    await prisma.shareCard.create({
      data: {
        id,
        userId: null,
        capturedAt: new Date(),
        latitude: 0,
        longitude: 0,
        snapshot: { schemaVersion: 1, id, notActually: 'a snapshot' },
      },
    });
    createdIds.push(id);

    const res = await request(appWith()).get(`/api/share/${id}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/share/:id/og.png', () => {
  it('serves a real 1200x630 PNG to a logged-out visitor', async () => {
    const created = await createCard();
    const res = await request(appWith())
      .get(`/api/share/${created.body.id}/og.png`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');

    const png = res.body as Buffer;
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('marks the image immutable — the render is deterministic', async () => {
    const created = await createCard();
    const res = await request(appWith()).get(`/api/share/${created.body.id}/og.png`);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('404s for an unknown id', async () => {
    const res = await request(appWith()).get('/api/share/Zz9-_aB1cD2e/og.png');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/share/:id/meta.html', () => {
  it('serves crawler-ready HTML with the OG tags filled in', async () => {
    const created = await createCard(
      appWith({
        publicApiOrigin: 'https://api.astranet.example',
        webOrigin: 'https://astranet.example',
      }),
    );
    const id = created.body.id;
    const res = await request(
      appWith({
        publicApiOrigin: 'https://api.astranet.example',
        webOrigin: 'https://astranet.example',
      }),
    ).get(`/api/share/${id}/meta.html`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');

    const html = res.text;
    // A crawler runs no JavaScript, so every tag must be in this response.
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain(
      `<meta property="og:image" content="https://api.astranet.example/api/share/${id}/og.png"`,
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://astranet.example/share/${id}"`,
    );
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it('describes the card with the same measurements the image shows', async () => {
    const created = await createCard();
    const res = await request(appWith()).get(`/api/share/${created.body.id}/meta.html`);

    const snapshot = created.body.snapshot as { facts: { label: string; value: string }[] };
    for (const fact of snapshot.facts) {
      expect(res.text).toContain(fact.label);
    }
  });

  it('404s for an unknown id', async () => {
    const res = await request(appWith()).get('/api/share/Zz9-_aB1cD2e/meta.html');
    expect(res.status).toBe(404);
  });
});

describe('the Phase 11 Definition of Done', () => {
  it('a generated card opens for a logged-out visitor and previews correctly', async () => {
    // One end-to-end pass with no credentials anywhere: create, read back,
    // fetch the image, fetch the crawler document.
    const app = appWith({
      publicApiOrigin: 'https://api.astranet.example',
      webOrigin: 'https://astranet.example',
    });

    const created = await createCard(app);
    expect(created.status).toBe(201);
    const id = created.body.id;

    const json = await request(app).get(`/api/share/${id}`);
    expect(json.status).toBe(200);
    // Parsed through the schema rather than poked at, so this asserts the
    // visitor received a whole, valid card and not merely a 200.
    const served = ShareSnapshotSchema.safeParse(json.body);
    expect(served.success).toBe(true);
    expect(served.success && served.data.headline.length).toBeGreaterThan(0);

    const png = await request(app).get(`/api/share/${id}/og.png`);
    expect(png.status).toBe(200);
    expect(png.headers['content-type']).toBe('image/png');

    const meta = await request(app).get(`/api/share/${id}/meta.html`);
    expect(meta.status).toBe(200);
    expect(meta.text).toContain(`https://api.astranet.example/api/share/${id}/og.png`);

    // Nothing in the flow set or required a cookie.
    expect(json.headers['set-cookie']).toBeUndefined();
    expect(png.headers['set-cookie']).toBeUndefined();
    expect(meta.headers['set-cookie']).toBeUndefined();
  });
});
