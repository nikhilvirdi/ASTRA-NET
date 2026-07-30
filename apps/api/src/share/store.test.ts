/**
 * `ShareCard` persistence (WORKPLAN.md Phase 11, SCHEMA.md).
 *
 * Runs against the real docker-compose Postgres rather than a mocked
 * Prisma: round-tripping a snapshot through JSONB is exactly where a blob
 * that "looks fine in memory" can come back subtly different, which a
 * mock would prove nothing about.
 */

import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../db/client.js';
import { generateShareId, readShareCard, saveShareCard } from './store.js';
import { SHARE_ID_PATTERN } from './share.schemas.js';
import { makeShareSnapshot } from './__fixtures__/snapshot.js';

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

/** Every card this file writes carries a fixture id, so cleanup is exact. */
const createdIds: string[] = [];

async function saveFixture(
  snapshot = makeShareSnapshot({ id: generateShareId() }),
): Promise<string> {
  await saveShareCard({ prisma, snapshot });
  createdIds.push(snapshot.id);
  return snapshot.id;
}

async function cleanup(): Promise<void> {
  if (createdIds.length > 0) {
    await prisma.shareCard.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('generateShareId', () => {
  it('produces 12 URL-safe characters, matching the schema pattern', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateShareId()).toMatch(SHARE_ID_PATTERN);
    }
  });

  it('is not enumerable — no collisions and no shared prefix ordering', () => {
    const ids = new Set(Array.from({ length: 2000 }, generateShareId));
    expect(ids.size).toBe(2000);

    // A time-ordered id (cuid, ULID) would leave successive ids sharing a
    // long prefix. 72 random bits must not.
    const sequential = Array.from({ length: 50 }, generateShareId);
    for (let i = 1; i < sequential.length; i += 1) {
      expect(sequential[i]!.slice(0, 4)).not.toBe(sequential[i - 1]!.slice(0, 4));
    }
  });

  it('never emits base64 padding or non-URL-safe characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generateShareId();
      expect(id).not.toContain('=');
      expect(id).not.toContain('+');
      expect(id).not.toContain('/');
    }
  });
});

describe('saveShareCard / readShareCard', () => {
  it('round-trips every displayed value of a snapshot unchanged', async () => {
    const snapshot = makeShareSnapshot({ id: generateShareId() });
    await saveFixture(snapshot);

    const result = await readShareCard(prisma, snapshot.id);
    if (result.status !== 'ok') throw new Error('expected the card to be readable');

    // Everything the card actually renders is a pre-formatted string, so
    // all of it must survive byte-exact. (The floats are checked
    // separately below — they do not, quite.)
    expect(result.snapshot.headline).toBe(snapshot.headline);
    expect(result.snapshot.facts).toEqual(snapshot.facts);
    expect(result.snapshot.observer.label).toBe('51.51°N 0.13°W');
    expect(result.snapshot.sky.surfaceHex).toBe(snapshot.sky.surfaceHex);
    expect(result.snapshot.availability).toEqual(snapshot.availability);
    expect(result.snapshot.horizon.markers.map((m) => m.sublabel)).toEqual(
      snapshot.horizon.markers.map((m) => m.sublabel),
    );
    // Non-ASCII survives the JSONB encoding intact.
    expect(result.snapshot.horizon.markers[0]?.sublabel).toBe('ALT −14.2°');
  });

  it('round-trips floats to 16 significant digits, not to the full f64', async () => {
    // Documented limit, not an aspiration: Prisma's query engine serializes
    // JSON numbers at 16 significant digits, so the 17th is dropped *on the
    // way in* — raw SQL confirms the shortened value is what Postgres
    // actually stores. JSONB itself is exact; this is the client.
    //
    // It is harmless here, and deliberately so: every value the card
    // *renders* is a pre-formatted string resolved at capture time, and
    // `surfaceHex` is stored rather than recomputed from `twilightValue` —
    // which is precisely the drift `build-snapshot.ts` stores it to avoid.
    const snapshot = makeShareSnapshot({ id: generateShareId() });
    await saveFixture(snapshot);

    const result = await readShareCard(prisma, snapshot.id);
    if (result.status !== 'ok') throw new Error('expected the card to be readable');

    const stored = result.snapshot.sky.twilightValue;
    expect(stored).not.toBe(2 + 2.2 / 6);
    expect(stored).toBeCloseTo(2 + 2.2 / 6, 12);
    expect(stored).toBe(Number((2 + 2.2 / 6).toPrecision(16)));
  });

  it('never lets that rounding push a value outside its own schema bound', async () => {
    // The one strictly-exclusive bound in the snapshot schema is
    // `sunAzimuthDeg < 360`. If 16-digit rounding could round a legal value
    // up to exactly 360, the card would come back permanently `corrupt`.
    // It cannot — the rounding is downward at this magnitude — but that is
    // worth proving against the real database rather than reasoning about.
    const snapshot = makeShareSnapshot({ id: generateShareId() });
    snapshot.sky.sunAzimuthDeg = 359.99999999999994;
    await saveFixture(snapshot);

    const result = await readShareCard(prisma, snapshot.id);
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.snapshot.sky.sunAzimuthDeg).toBeLessThan(360);
  });

  it('reports a missing card as not-found rather than throwing', async () => {
    expect(await readShareCard(prisma, generateShareId())).toEqual({ status: 'not-found' });
  });

  it('reports a stored blob that no longer parses as corrupt, never as missing', async () => {
    // The distinction matters: "this card does not exist" and "this card
    // exists but this build can no longer read it" are different bugs, and
    // a 404 for the second would hide a real server-side problem.
    const id = generateShareId();
    await prisma.shareCard.create({
      data: {
        id,
        capturedAt: new Date(),
        latitude: 0,
        longitude: 0,
        snapshot: { schemaVersion: 1, id, notActually: 'a snapshot' },
      },
    });
    createdIds.push(id);

    expect(await readShareCard(prisma, id)).toEqual({ status: 'corrupt' });
  });

  it('treats a snapshot from a newer schema version as corrupt rather than half-rendering it', async () => {
    const id = generateShareId();
    await prisma.shareCard.create({
      data: {
        id,
        capturedAt: new Date(),
        latitude: 0,
        longitude: 0,
        snapshot: { ...makeShareSnapshot({ id }), schemaVersion: 2 },
      },
    });
    createdIds.push(id);

    expect(await readShareCard(prisma, id)).toEqual({ status: 'corrupt' });
  });

  it('denormalizes capturedAt and the coordinates alongside the blob', async () => {
    const snapshot = makeShareSnapshot({ id: generateShareId() });
    await saveFixture(snapshot);

    const row = await prisma.shareCard.findUnique({
      where: { id: snapshot.id },
      select: { capturedAt: true, latitude: true, longitude: true },
    });
    expect(row?.capturedAt.toISOString()).toBe(snapshot.capturedAt);
    expect(row?.latitude).toBeCloseTo(snapshot.observer.latDeg, 6);
    expect(row?.longitude).toBeCloseTo(snapshot.observer.lonDeg, 6);
  });

  it('refuses to write two cards with the same id', async () => {
    const snapshot = makeShareSnapshot({ id: generateShareId() });
    await saveFixture(snapshot);
    await expect(saveShareCard({ prisma, snapshot })).rejects.toThrow();
  });
});
