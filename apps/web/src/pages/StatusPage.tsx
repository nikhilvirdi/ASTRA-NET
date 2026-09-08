import { API_BASE } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import { LivePulse } from '@/components/common/LivePulse';
import { formatRelativeTime } from '@/lib/space-weather-status';

/** Which network source served a satellite category's last successful fetch — mirrors the api's `SatelliteSource` (apps/api/src/poller/store.ts). */
export type SatelliteSourceValue = 'celestrak' | 'space-track-fallback' | null;

export interface HealthSource {
  healthy: boolean;
  fetchedAt: string | null;
  /** Present only on the `satellites` entry — see `SATELLITE_CATEGORY_LABELS` below. */
  categorySources?: Record<string, SatelliteSourceValue>;
}

interface HealthPayload {
  status: 'ok';
  checkedAt: string;
  sources: Record<string, HealthSource>;
}

const SOURCE_LABELS: Record<string, string> = {
  iss: 'ISS POSITION',
  solarWind: 'SOLAR WIND / KP',
  spaceWeatherForecast: 'SPACE WEATHER FORECAST',
  donki: 'DONKI (CME)',
  neows: 'NEO TRACKER',
  gibs: 'GIBS IMAGERY',
  horizons: 'JPL HORIZONS',
  horizonsJupiter: 'JUPITER EPHEMERIS',
  horizonsVenus: 'VENUS EPHEMERIS',
  horizonsMars: 'MARS EPHEMERIS',
  horizonsSaturn: 'SATURN EPHEMERIS',
  horizonsMercury: 'MERCURY EPHEMERIS',
};

/**
 * The `satellites` entry's `categorySources` is expanded into one status row
 * per category instead of a single "LIVE SATELLITES" line, in this order.
 * `debris` maps to three underlying CelesTrak groups internally
 * (apps/api/src/poller/slow-tier.ts's `DEBRIS_GROUP_NAMES`), but the backend
 * reports one source for the category as a whole — rendered identically to
 * every other category here, not as a special case, so this row never
 * implies a finer per-sub-group breakdown than the data actually has.
 */
const SATELLITE_CATEGORY_LABELS: Record<string, string> = {
  stations: 'Stations',
  starlink: 'Starlink',
  oneweb: 'OneWeb',
  gps: 'GPS',
  weather: 'Weather',
  geo: 'Geo',
  cubesat: 'CubeSat',
  debris: 'Debris',
  hubble: 'Hubble',
};

const SATELLITE_SOURCE_LABELS: Record<'celestrak' | 'space-track-fallback', string> = {
  celestrak: 'CelesTrak',
  'space-track-fallback': 'Space-Track Fallback',
};

export interface StatusRow {
  key: string;
  label: string;
  healthy: boolean;
  fetchedAt: string | null;
  /** Small secondary attribution label, e.g. "CelesTrak" — same style as SolarWindTelemetry's "NOAA SWPC RTSW". */
  sourceLabel?: string;
}

/**
 * Flattens `health.sources` into display rows, one per line on the page.
 * Every source is one row except `satellites`, whose `categorySources` map
 * (apps/api's per-category source tracking) expands into nine rows — a
 * category with a `null` source has never once succeeded on either network
 * source, which is "unavailable," not a fetch error, so it renders the same
 * unavailable state as any other never-fetched source rather than a
 * distinct error treatment.
 */
export function buildStatusRows(sources: Record<string, HealthSource>): StatusRow[] {
  const rows: StatusRow[] = [];

  for (const [key, source] of Object.entries(sources)) {
    if (key === 'satellites') {
      const categorySources = source.categorySources ?? {};
      for (const [catKey, catLabel] of Object.entries(SATELLITE_CATEGORY_LABELS)) {
        const catSource = categorySources[catKey] ?? null;
        rows.push({
          key: `satellites-${catKey}`,
          label: catLabel,
          healthy: catSource !== null,
          fetchedAt: null,
          sourceLabel: catSource ? SATELLITE_SOURCE_LABELS[catSource] : undefined,
        });
      }
      continue;
    }

    rows.push({
      key,
      label: SOURCE_LABELS[key] || key.toUpperCase(),
      healthy: source.healthy,
      fetchedAt: source.fetchedAt,
    });
  }

  return rows;
}

export function StatusPage(): React.ReactElement {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
          const data = (await res.json()) as HealthPayload;
          if (mounted) {
            setHealth(data);
            setNow(new Date());
          }
        }
      } catch (err) {
        // Ignore network errors, keep previous state
      }
    };

    void fetchHealth();
    const interval = setInterval(() => {
      void fetchHealth();
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <main
      id="main-content"
      className="pt-16 sm:pt-24 px-4 sm:px-8 pb-20 sm:pb-32 max-w-2xl mx-auto space-y-8 sm:space-y-10"
    >
      <header className="space-y-2">
        <h1 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
          System Status
        </h1>
        <p className="type-body text-sm sm:text-base text-sky-200 break-words">
          Live poller source health and telemetry freshness.
        </p>
      </header>

      <section className="space-y-4 border-t border-sky-800/40 pt-6">
        {!health ? (
          <div className="font-jost text-xs uppercase tracking-wider text-sky-400 animate-pulse">
            LOADING...
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-sky-800/30">
            {buildStatusRows(health.sources).map((row) => {
              const relTime = formatRelativeTime(row.fetchedAt, now);
              const statusText = relTime ? `UPDATED ${relTime.toUpperCase()} AGO` : 'UNAVAILABLE';

              return (
                <div
                  key={row.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-3.5 gap-1.5 sm:gap-4"
                >
                  <span className="font-jost text-xs uppercase tracking-wider text-sky-200 font-medium break-words">
                    {row.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {row.sourceLabel && (
                      <span className="font-jost text-[10px] text-sky-400 uppercase">
                        {row.sourceLabel}
                      </span>
                    )}
                    {row.healthy ? (
                      <LivePulse label="LIVE" active={true} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-jost text-xs tracking-wider text-sky-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        {statusText}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
