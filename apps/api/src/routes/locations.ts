/**
 * `/api/locations` routes (WORKPLAN.md Phase 6 — Saved locations).
 * Every route requires a valid access token (`requireAuth`) and every
 * query/mutation is scoped to `req.userId` — per `SCHEMA.md`'s "per-user
 * isolation is enforced in the API layer" and WORKPLAN.md rule "no
 * endpoint may read another user's rows."
 *
 * Cross-user access (a real location id that belongs to someone else)
 * and a nonexistent location id are deliberately indistinguishable to
 * the caller — both return a generic 404, never a 403 — so a client
 * can't use this API to probe which location ids exist.
 */

import express, { type Express, type Request, type Response } from 'express';
import type { Location, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../auth/require-auth.js';

export interface LocationsRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
}

const LABEL_MAX_LENGTH = 100;

const CreateLocationBodySchema = z.object({
  label: z.string().trim().min(1).max(LABEL_MAX_LENGTH),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * `isDefault` only ever accepts `true` here — "make this location the
 * default" is a meaningful request, but "unset the default" is not: as
 * long as a user has at least one location, exactly one of them must be
 * the default (`SCHEMA.md`'s Location model). Un-defaulting only ever
 * happens implicitly, by another location becoming default instead.
 */
const UpdateLocationBodySchema = z
  .object({
    label: z.string().trim().min(1).max(LABEL_MAX_LENGTH).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isDefault: z.literal(true).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

function logUnexpectedLocationsError(routeLabel: string, error: unknown): void {
  console.error(
    `[locations] ${routeLabel} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

/** Fetches a location and confirms it belongs to `userId`; returns null for "not found or not yours" alike. */
async function findOwnedLocation(
  prisma: PrismaClient,
  locationId: string,
  userId: string,
): Promise<Location | null> {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (location === null || location.userId !== userId) return null;
  return location;
}

export function registerLocationsRoutes(app: Express, deps: LocationsRouteDeps): void {
  const { prisma, jwtAccessSecret } = deps;
  const auth = requireAuth({ jwtAccessSecret });

  app.get('/api/locations', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    try {
      const locations = await prisma.location.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      res.status(200).json(locations);
    } catch (error) {
      logUnexpectedLocationsError('list', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.get('/api/locations/:id', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    try {
      const location = await findOwnedLocation(prisma, req.params.id as string, userId);
      if (location === null) {
        res.status(404).json({ error: 'location not found' });
        return;
      }
      res.status(200).json(location);
    } catch (error) {
      logUnexpectedLocationsError('get', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * A user's very first location is always auto-defaulted, regardless of
   * the request body — there is no explicit `isDefault` field accepted
   * on create at all, precisely so this can't be bypassed or requested
   * for a non-first location. Making an existing location the default
   * later is `PATCH`'s job.
   */
  app.post('/api/locations', auth, express.json(), async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const parsed = CreateLocationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'label, latitude, and longitude are required and must be valid' });
      return;
    }
    try {
      const existingCount = await prisma.location.count({ where: { userId } });
      const location = await prisma.location.create({
        data: { userId, ...parsed.data, isDefault: existingCount === 0 },
      });
      res.status(201).json(location);
    } catch (error) {
      logUnexpectedLocationsError('create', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * Switching the default is the one mutation that touches more than
   * one row (the previous default must be unset), so it runs inside a
   * `$transaction` — a mid-flight failure must never leave two
   * locations, or zero, marked default.
   */
  app.patch('/api/locations/:id', auth, express.json(), async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const locationId = req.params.id as string;
    const parsed = UpdateLocationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'no valid fields to update' });
      return;
    }
    const { isDefault, ...fields } = parsed.data;

    try {
      const existing = await findOwnedLocation(prisma, locationId, userId);
      if (existing === null) {
        res.status(404).json({ error: 'location not found' });
        return;
      }

      if (isDefault === true) {
        const [, updated] = await prisma.$transaction([
          prisma.location.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          }),
          prisma.location.update({
            where: { id: locationId },
            data: { ...fields, isDefault: true },
          }),
        ]);
        res.status(200).json(updated);
        return;
      }

      const updated = await prisma.location.update({ where: { id: locationId }, data: fields });
      res.status(200).json(updated);
    } catch (error) {
      logUnexpectedLocationsError('update', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * Deleting the current default promotes the user's next-oldest
   * remaining location to default (also `$transaction`-wrapped, for the
   * same reason as `PATCH`'s switch) so a user with any locations left
   * always still has exactly one default. Deleting a non-default
   * location, or the user's only location, is a plain delete.
   */
  app.delete('/api/locations/:id', auth, async (req: Request, res: Response) => {
    const userId = req.userId as string;
    const locationId = req.params.id as string;
    try {
      const existing = await findOwnedLocation(prisma, locationId, userId);
      if (existing === null) {
        res.status(404).json({ error: 'location not found' });
        return;
      }

      if (existing.isDefault) {
        const nextDefault = await prisma.location.findFirst({
          where: { userId, id: { not: locationId } },
          orderBy: { createdAt: 'asc' },
        });
        if (nextDefault !== null) {
          await prisma.$transaction([
            prisma.location.delete({ where: { id: locationId } }),
            prisma.location.update({ where: { id: nextDefault.id }, data: { isDefault: true } }),
          ]);
          res.status(204).send();
          return;
        }
      }

      await prisma.location.delete({ where: { id: locationId } });
      res.status(204).send();
    } catch (error) {
      logUnexpectedLocationsError('delete', error);
      res.status(500).json({ error: 'internal error' });
    }
  });
}
