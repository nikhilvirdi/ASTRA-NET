/**
 * `/api/share` — the Shareable Sky Card (WORKPLAN.md Phase 11,
 * ARCHITECTURE.md §8's `/share/:id` "public"). Four endpoints, all of them
 * genuinely login-free (there is no account system at all):
 *
 *   POST /api/share               create a snapshot of a Brief moment
 *   GET  /api/share/:id           the snapshot, as JSON
 *   GET  /api/share/:id/og.png    the 1200x630 twilight-accurate card
 *   GET  /api/share/:id/meta.html the crawler document with the OG tags
 *
 * The snapshot is built from a Brief this server composes at that instant,
 * never from a client-supplied payload — a shared card is a public claim
 * about the sky, so it has to be one this server actually made.
 *
 * **Not built here, flagged deliberately:** `POST /api/share` is an
 * unauthenticated write, so an anonymous caller can create rows without
 * bound. Rate limiting is WORKPLAN.md Phase 12's "rate-limit budget
 * verification", and there is no rate-limiting layer anywhere in the app
 * yet — adding one only for this route would put a second, divergent
 * policy in the codebase ahead of the phase that defines the first. See
 * PROGRESS.md.
 */

import express, { type Express, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { composeBriefForObserver, type ComposeBriefDeps } from '../brief/compose-brief.js';
import { buildShareSnapshot } from '../share/build-snapshot.js';
import { generateShareId, readShareCard, saveShareCard } from '../share/store.js';
import { renderShareCardPng } from '../share/og-image.js';
import { renderShareMetaHtml } from '../share/meta-html.js';
import { OG_HEIGHT, OG_WIDTH } from '../share/og-svg.js';
import {
  CreateShareBodySchema,
  CreateShareResponseSchema,
  ShareIdSchema,
  ShareSnapshotSchema,
  type ShareSnapshot,
} from '../share/share.schemas.js';

/**
 * A snapshot never changes, so its JSON, its PNG and its meta document are
 * all safe to cache for as long as anything will hold them. This is what
 * keeps the OG image cheap without a second cache inside the process.
 */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface ShareRouteDeps extends ComposeBriefDeps {
  prisma: PrismaClient;
  /**
   * Absolute origin this API is reachable at, used to build the `og:image`
   * URL (OG consumers reject relative image URLs). Optional: when unset it
   * is derived from the request, which is correct for local development
   * and for any deployment that is not behind an origin-rewriting proxy.
   */
  publicApiOrigin?: string;
  /**
   * Absolute origin of `apps/web`, where the human-facing `/share/:id`
   * page lives. Reuses the existing `WEB_ORIGIN` env var (already read for
   * Google OAuth) rather than introducing a second name for the same
   * thing. Falls back to the API origin when unset.
   */
  webOrigin?: string;
}

function resolveApiOrigin(req: Request, configured: string | undefined): string {
  if (configured !== undefined && configured !== '') return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host') ?? 'localhost'}`;
}

function resolveWebOrigin(req: Request, deps: ShareRouteDeps): string {
  if (deps.webOrigin !== undefined && deps.webOrigin !== '') {
    return deps.webOrigin.replace(/\/+$/, '');
  }
  return resolveApiOrigin(req, deps.publicApiOrigin);
}

function shareUrlFor(webOrigin: string, id: string): string {
  return `${webOrigin}/share/${id}`;
}

function ogImageUrlFor(apiOrigin: string, id: string): string {
  return `${apiOrigin}/api/share/${id}/og.png`;
}

/**
 * Shared by all three read endpoints: validates the id shape before it
 * ever reaches the database (an id that cannot exist is a 404, not a
 * query), then reads and parses the stored blob. Returns null having
 * already sent the response when the card cannot be served.
 */
async function loadSnapshotOr404(
  req: Request,
  res: Response,
  prisma: PrismaClient,
): Promise<ShareSnapshot | null> {
  const id = ShareIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(404).json({ error: 'no share card with that id' });
    return null;
  }

  const result = await readShareCard(prisma, id.data);
  if (result.status === 'not-found') {
    res.status(404).json({ error: 'no share card with that id' });
    return null;
  }
  if (result.status === 'corrupt') {
    // The row exists but no longer satisfies its own schema — a real
    // server-side problem, never disguised as "this card doesn't exist".
    console.error(`[share] stored snapshot failed its own schema: ${id.data}`);
    res.status(500).json({ error: 'share card could not be read' });
    return null;
  }
  return result.snapshot;
}

export function registerShareRoutes(app: Express, deps: ShareRouteDeps): void {
  // `express.json()` is scoped per-route here, matching the convention
  // every other body-taking route in this app already follows.
  app.post('/api/share', express.json(), async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateShareBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'lat and lon are required and must be valid coordinates' });
      return;
    }

    const now = new Date();
    const brief = await composeBriefForObserver(deps, parsed.data.lat, parsed.data.lon, now);

    const snapshot = buildShareSnapshot({ id: generateShareId(), brief, createdAt: now });

    const apiOrigin = resolveApiOrigin(req, deps.publicApiOrigin);
    const payload = {
      id: snapshot.id,
      shareUrl: shareUrlFor(resolveWebOrigin(req, deps), snapshot.id),
      ogImageUrl: ogImageUrlFor(apiOrigin, snapshot.id),
      snapshot,
    };

    // Validate before persisting, not after: a snapshot that fails its own
    // schema must never become a permanent, publicly-linkable row.
    const validated = CreateShareResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[share] snapshot failed its own schema:', validated.error.issues);
      res.status(500).json({ error: 'share snapshot failed validation' });
      return;
    }

    try {
      await saveShareCard({ prisma: deps.prisma, snapshot });
    } catch (error) {
      console.error(
        `[share] could not persist share card: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      res.status(500).json({ error: 'share card could not be saved' });
      return;
    }

    res.status(201).json(payload);
  });

  app.get('/api/share/:id', async (req: Request, res: Response): Promise<void> => {
    const snapshot = await loadSnapshotOr404(req, res, deps.prisma);
    if (snapshot === null) return;

    // Re-validated on the way out for the same reason `/api/best-spot`
    // does it: the response is the contract `apps/web` is written against.
    const validated = ShareSnapshotSchema.safeParse(snapshot);
    if (!validated.success) {
      console.error('[share] response failed its own schema:', validated.error.issues);
      res.status(500).json({ error: 'share card could not be read' });
      return;
    }

    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
    res.json(snapshot);
  });

  app.get('/api/share/:id/og.png', async (req: Request, res: Response): Promise<void> => {
    const snapshot = await loadSnapshotOr404(req, res, deps.prisma);
    if (snapshot === null) return;

    let png: Buffer;
    try {
      png = renderShareCardPng(snapshot);
    } catch (error) {
      console.error(
        `[share] OG render failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      res.status(500).json({ error: 'share card image could not be rendered' });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
    res.send(png);
  });

  app.get('/api/share/:id/meta.html', async (req: Request, res: Response): Promise<void> => {
    const snapshot = await loadSnapshotOr404(req, res, deps.prisma);
    if (snapshot === null) return;

    const apiOrigin = resolveApiOrigin(req, deps.publicApiOrigin);
    const html = renderShareMetaHtml({
      snapshot,
      shareUrl: shareUrlFor(resolveWebOrigin(req, deps), snapshot.id),
      ogImageUrl: ogImageUrlFor(apiOrigin, snapshot.id),
      ogImageWidth: OG_WIDTH,
      ogImageHeight: OG_HEIGHT,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
    res.send(html);
  });
}
