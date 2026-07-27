/**
 * `/api/settings` (WORKPLAN.md Phase 10, DESIGN_SPEC.md §15).
 *
 * Covers the two parts of §15's page that aren't already their own
 * resource: the ALERTS toggles, and which saved location is the default.
 *
 * Deliberately **not** re-exposed here, because Phase 6 already built them
 * and a second contract over the same rows would drift:
 *   - SAVED LOCATIONS -> `/api/locations` (full CRUD, per-user isolated).
 *     This route reports the current default read-only, so the settings
 *     page can render it without a second vocabulary for the same rows.
 *   - YOUR DATA (delete-my-data) -> `DELETE /api/auth/account`, which
 *     already performs the real cascade delete. No alias is added here:
 *     one destructive operation should have exactly one path.
 *
 * Auth required on every route (ARCHITECTURE.md §8 marks `/settings`
 * "required"), scoped to `req.userId`.
 */

import express, { type Express, type Request, type Response } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth/require-auth.js';
import { SettingsPayloadSchema, UpdateAlertsBodySchema } from '../settings/settings.schemas.js';
import {
  applyAlertUpdate,
  mergeIntoStored,
  parseUserSettings,
  type UserSettings,
} from '../settings/user-settings.js';

/**
 * No alert delivery mechanism exists in ARCHITECTURE.md — no push service,
 * no mail transport. The toggles are stored faithfully, but the page is
 * told plainly that nothing can act on them yet rather than implying a
 * working feature. Flip this when delivery actually ships.
 */
const ALERTS_DELIVERABLE = false;

export interface SettingsRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
}

function logUnexpectedSettingsError(routeLabel: string, error: unknown): void {
  console.error(
    `[settings] ${routeLabel} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

export function registerSettingsRoutes(app: Express, deps: SettingsRouteDeps): void {
  const { prisma, jwtAccessSecret } = deps;
  const auth = requireAuth({ jwtAccessSecret });

  /** Reads settings + default location for a user, or null if the user is gone. */
  async function loadPayload(
    userId: string,
  ): Promise<{ settings: UserSettings; payload: unknown } | null> {
    const [user, defaultLocation] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { settings: true } }),
      prisma.location.findFirst({
        where: { userId, isDefault: true },
        select: { id: true, label: true, latitude: true, longitude: true },
      }),
    ]);
    if (user === null) return null;

    const settings = parseUserSettings(user.settings);
    return {
      settings,
      payload: {
        alerts: settings.alerts,
        defaultLocation: defaultLocation ?? null,
        alertsDeliverable: ALERTS_DELIVERABLE,
      },
    };
  }

  function respond(res: Response, payload: unknown): void {
    const validated = SettingsPayloadSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[settings] response failed its own schema:', validated.error.issues);
      res.status(500).json({ error: 'settings payload failed validation' });
      return;
    }
    res.status(200).json(payload);
  }

  app.get('/api/settings', auth, async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId as string;
    try {
      const loaded = await loadPayload(userId);
      if (loaded === null) {
        // A valid token for a deleted account — the delete-my-data path
        // leaves tokens technically valid until they expire.
        res.status(404).json({ error: 'user not found' });
        return;
      }
      respond(res, loaded.payload);
    } catch (error) {
      logUnexpectedSettingsError('get', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.put(
    '/api/settings/alerts',
    auth,
    express.json(),
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.userId as string;
      const parsed = UpdateAlertsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error:
            'alerts must be an object with at least one of iss_pass, aurora, meteor_shower, neo_approach set to a boolean',
        });
        return;
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { settings: true },
        });
        if (user === null) {
          res.status(404).json({ error: 'user not found' });
          return;
        }

        const updated = applyAlertUpdate(parseUserSettings(user.settings), parsed.data.alerts);
        // Merge rather than replace: the blob is shared with any future
        // preference group, and a write that dropped another feature's key
        // would be silent cross-feature data loss.
        await prisma.user.update({
          where: { id: userId },
          data: {
            settings: mergeIntoStored(user.settings, updated) as Prisma.InputJsonValue,
          },
        });

        const loaded = await loadPayload(userId);
        if (loaded === null) {
          res.status(404).json({ error: 'user not found' });
          return;
        }
        respond(res, loaded.payload);
      } catch (error) {
        logUnexpectedSettingsError('update-alerts', error);
        res.status(500).json({ error: 'internal error' });
      }
    },
  );
}
