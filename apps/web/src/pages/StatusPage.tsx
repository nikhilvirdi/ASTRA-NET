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
    <main id="main-content" className="pt-24 px-8 pb-32 max-w-2xl mx-auto space-y-12">
      <header className="space-y-4">
        <h1 className="type-title text-brass-300 font-mono tracking-widest uppercase">
          SYSTEM STATUS
        </h1>
        <p className="type-body text-sky-200">Live poller source health and telemetry freshness.</p>
      </header>

      <section className="space-y-4 border-t border-sky-900/50 pt-8">
        {!health ? (
          <div className="type-micro text-sky-400">LOADING...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(health.sources).map(([key, source]) => {
              const label = SOURCE_LABELS[key] || key.toUpperCase();
              const isHealthy = source.healthy;
              const relTime = formatRelativeTime(source.fetchedAt, now);
              const statusText = relTime ? `UPDATED ${relTime.toUpperCase()} AGO` : 'UNAVAILABLE';

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between font-mono text-xs ${
                    isHealthy ? 'text-sky-100' : 'text-sky-400 opacity-50'
                  }`}
                >
                  <span className="tracking-widest uppercase">{label}</span>
                  <div className="flex items-center">
                    {isHealthy ? (
                      <LivePulse label="LIVE" active={true} />
                    ) : (
                      <span className="text-sky-400 tracking-wider">● {statusText}</span>
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
