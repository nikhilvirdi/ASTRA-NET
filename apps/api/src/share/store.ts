/**
 * `ShareCard` table access (SCHEMA.md / WORKPLAN.md Phase 11). Plain
 * functions over an injected `PrismaClient`, the same shape as
 * `cache/store.ts` — no route logic here, no rendering.
 *
 * Two things this module is responsible for:
 *
 * 1. **Unguessable ids.** Every other model uses `@default(cuid())`, which
 *    is fine for rows only their owner can request. A share card is
 *    world-readable by anyone holding its id and carries the observer's
 *    coordinates, so its id is 9 random bytes from `node:crypto` rendered
 *    base64url — 72 bits, not enumerable, not time-ordered.
 *
 * 2. **Treating a stored snapshot as untrusted input on the way out.** The
 *    blob may have been written months ago by an older build, so it is
 *    parsed through `ShareSnapshotSchema` on read rather than cast. A row
 *    that no longer satisfies the schema is reported as unreadable instead
 *    of being half-rendered — which is what makes "self-contained" a
 *    property the code checks rather than a claim it makes.
 */

import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ShareSnapshotSchema, type ShareSnapshot } from './share.schemas.js';

/** 9 bytes -> exactly 12 base64url characters, no padding. */
const SHARE_ID_BYTES = 9;

export function generateShareId(): string {
  return crypto.randomBytes(SHARE_ID_BYTES).toString('base64url');
}

export interface SaveShareCardParams {
  prisma: PrismaClient;
  snapshot: ShareSnapshot;
  /** Null for an anonymous share; set means delete-my-data will remove this card. */
  userId: string | null;
}

export async function saveShareCard({
  prisma,
  snapshot,
  userId,
}: SaveShareCardParams): Promise<void> {
  await prisma.shareCard.create({
    data: {
      id: snapshot.id,
      userId,
      capturedAt: new Date(snapshot.capturedAt),
      latitude: snapshot.observer.latDeg,
      longitude: snapshot.observer.lonDeg,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

export type ShareCardReadResult =
  | { status: 'ok'; snapshot: ShareSnapshot }
  | { status: 'not-found' }
  /** The row exists but its blob no longer parses — a real error, never a silent 404. */
  | { status: 'corrupt' };

export async function readShareCard(
  prisma: PrismaClient,
  id: string,
): Promise<ShareCardReadResult> {
  const row = await prisma.shareCard.findUnique({ where: { id }, select: { snapshot: true } });
  if (row === null) return { status: 'not-found' };

  const parsed = ShareSnapshotSchema.safeParse(row.snapshot);
  if (!parsed.success) return { status: 'corrupt' };
  return { status: 'ok', snapshot: parsed.data };
}
