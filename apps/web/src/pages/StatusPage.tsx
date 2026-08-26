import React, { useEffect, useState } from 'react';
import { LivePulse } from '@/components/common/LivePulse';
import { formatRelativeTime } from '@/lib/space-weather-status';

interface HealthSource {
  healthy: boolean;
  fetchedAt: string | null;
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
  satellites: 'LIVE SATELLITES',
};

export function StatusPage(): React.ReactElement {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch('/health');
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
            {Object.entries(health.sources).map(([key, source]) => {
              const label = SOURCE_LABELS[key] || key.toUpperCase();
              const isHealthy = source.healthy;
              const relTime = formatRelativeTime(source.fetchedAt, now);
              const statusText = relTime ? `UPDATED ${relTime.toUpperCase()} AGO` : 'UNAVAILABLE';

              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-3.5 gap-1.5 sm:gap-4"
                >
                  <span className="font-jost text-xs uppercase tracking-wider text-sky-200 font-medium break-words">
                    {label}
                  </span>
                  <div className="flex items-center shrink-0 self-start sm:self-auto">
                    {isHealthy ? (
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
