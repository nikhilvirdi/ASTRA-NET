/**
 * `/health` (ARCHITECTURE.md §4): doubles as the keep-warm target and the
 * poller liveness check. A 200 response is itself proof the process is
 * alive (the poller loops run in this same process, per Phase 3's design —
 * there is no separate poller process to probe). The body adds per-source
 * health flags from the store so a caller can also see *which* sources are
 * currently degraded, per ARCHITECTURE.md §5's degradation contract.
 *
 * No DB liveness check here: Phase 3 has no database dependency yet
 * (Postgres/Prisma wiring is Phase 6 territory) — nothing to report on but
 * the poller's own state.
 *
 * `buildHealthPayload` is the testable core, kept separate from the Express
 * wrapper, mirroring the fast/slow-tier loops' testable-core pattern.
 */

import type { Express, Request, Response } from 'express';
import { getAllSourceStates, type SourceKey } from '../poller/store.js';

export interface HealthPayload {
  status: 'ok';
  checkedAt: string;
  sources: Record<SourceKey, { healthy: boolean; fetchedAt: string | null }>;
}

export function buildHealthPayload(now: Date): HealthPayload {
  const state = getAllSourceStates();

  return {
    status: 'ok',
    checkedAt: now.toISOString(),
    sources: {
      iss: { healthy: state.iss.healthy, fetchedAt: state.iss.fetchedAt },
      solarWind: { healthy: state.solarWind.healthy, fetchedAt: state.solarWind.fetchedAt },
      spaceWeatherForecast: {
        healthy: state.spaceWeatherForecast.healthy,
        fetchedAt: state.spaceWeatherForecast.fetchedAt,
      },
      donki: { healthy: state.donki.healthy, fetchedAt: state.donki.fetchedAt },
      neows: { healthy: state.neows.healthy, fetchedAt: state.neows.fetchedAt },
      gibs: { healthy: state.gibs.healthy, fetchedAt: state.gibs.fetchedAt },
      horizons: { healthy: state.horizons.healthy, fetchedAt: state.horizons.fetchedAt },
      horizonsJupiter: {
        healthy: state.horizonsJupiter.healthy,
        fetchedAt: state.horizonsJupiter.fetchedAt,
      },
      horizonsVenus: {
        healthy: state.horizonsVenus.healthy,
        fetchedAt: state.horizonsVenus.fetchedAt,
      },
      horizonsMars: {
        healthy: state.horizonsMars.healthy,
        fetchedAt: state.horizonsMars.fetchedAt,
      },
      horizonsSaturn: {
        healthy: state.horizonsSaturn.healthy,
        fetchedAt: state.horizonsSaturn.fetchedAt,
      },
      horizonsMercury: {
        healthy: state.horizonsMercury.healthy,
        fetchedAt: state.horizonsMercury.fetchedAt,
      },
      satellites: { healthy: state.satellites.healthy, fetchedAt: state.satellites.fetchedAt },
    },
  };
}

export function registerHealthRoute(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json(buildHealthPayload(new Date()));
  });
}
