/**
 * SSE `/stream` (ARCHITECTURE.md §4 + §4's Honesty rule): pushes fast-tier
 * data only — ISS position and SWPC solar wind/Kp. Slow-tier sources
 * (DONKI/NeoWs/GIBS/Horizons) are deliberately excluded from this payload's
 * shape, not just unpopulated — they're read on-demand elsewhere (Phase 4's
 * `/api/brief`), never streamed, so nothing here blurs "live" (fast tier)
 * with "updated Xm ago" (slow tier).
 *
 * Each source keeps its own `fetchedAt`/`healthy` from the store as-is —
 * that's the freshness tag the client renders. `streamedAt` (when this SSE
 * push happened) is a separate field: it's when the message was *sent*, not
 * when the underlying data was *fetched*, and callers must not conflate the
 * two.
 *
 * `buildFastTierStreamPayload` is the testable core (pure function over the
 * store, no Express/network), mirroring the fast/slow-tier loops' pattern.
 * `registerStreamRoute` is the thin Express/SSE wrapper: it re-pushes the
 * current snapshot on a fixed interval, independent of the fast-tier loop's
 * own refresh cadence, so a) new fetches show up promptly and b) the
 * connection gets a steady heartbeat even between fetches (proxies can
 * otherwise time out an idle SSE connection). Re-sending an unchanged
 * snapshot is honest, not stale, since the client reads freshness from each
 * source's own unchanged `fetchedAt`, not from `streamedAt`.
 */

import type { Express, Request, Response } from 'express';
import { getSourceState, type SourceState } from '../poller/store.js';
import type { N2yoPositionsData } from '../clients/n2yo/index.js';
import type { SwpcFastData } from '../clients/swpc/index.js';

/** Re-push cadence for the SSE connection — deliberately independent of FAST_TIER_INTERVAL_MS. */
export const STREAM_PUSH_INTERVAL_MS = 5_000;

export interface FastTierStreamPayload {
  iss: SourceState<N2yoPositionsData>;
  solarWind: SourceState<SwpcFastData>;
  streamedAt: string;
}

export function buildFastTierStreamPayload(now: Date): FastTierStreamPayload {
  return {
    iss: getSourceState('iss'),
    solarWind: getSourceState('solarWind'),
    streamedAt: now.toISOString(),
  };
}

export function formatSseEvent(payload: FastTierStreamPayload): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * `pushIntervalMs` defaults to `STREAM_PUSH_INTERVAL_MS` in production; tests
 * pass a short override so they don't have to wait out the real cadence to
 * observe a second push.
 */
export function registerStreamRoute(app: Express, pushIntervalMs = STREAM_PUSH_INTERVAL_MS): void {
  app.get('/stream', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const push = (): void => {
      res.write(formatSseEvent(buildFastTierStreamPayload(new Date())));
    };

    push();
    const timer = setInterval(push, pushIntervalMs);

    req.on('close', () => {
      clearInterval(timer);
    });
  });
}
