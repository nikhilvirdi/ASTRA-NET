import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { twilightStateForSunAltitude } from '@astranet/shared';
import { fetchBrief, getEffectiveLocation, type DailyBrief } from '@/lib/api';
import { HorizonBand } from '@/components/brief/HorizonBand';
import { LivePulse } from '@/components/common/LivePulse';
import { FreshnessIndicator } from '@/components/common/FreshnessIndicator';
import { ConfidenceTicks } from '@/components/common/ConfidenceTicks';

export function BriefPage(): React.ReactElement {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const location = getEffectiveLocation();

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchBrief(location.lat, location.lon)
      .then((data) => {
        if (mounted) {
          setBrief(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('[BriefPage] fetch error:', err);
          setError('Failed to fetch sky data from network.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [location.lat, location.lon]);

  // Date formatting for Eyebrow
  const todayDateStr = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
    .toUpperCase();

  // Twilight state calculation
  const sunAltDeg = brief?.skyAnchor.data?.sunAltitudeDeg ?? -14.2;
  const twilightState = twilightStateForSunAltitude(sunAltDeg);
  const twilightPhaseLabel =
    twilightState.phase === 'day'
      ? 'DAYLIGHT'
      : twilightState.phase === 'night'
        ? 'NIGHT'
        : `${twilightState.phase.toUpperCase()} TWILIGHT`;

  if (error) {
    return (
      <main
        id="main-content"
        className="max-w-[1000px] mx-auto pt-8 px-6 pb-24 flex flex-col gap-12"
      >
        <section aria-label="Error state">
          <h1 className="type-display-xl text-ember-400 max-w-[900px] leading-tight">
            Telemetry Failure
          </h1>
          <p className="type-body-l text-sky-200 mt-4 max-w-[600px]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-4 py-2 border border-brass-500 text-brass-500 hover:bg-brass-500/10 transition-colors type-micro rounded cursor-pointer"
          >
            RETRY CONNECTION
          </button>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="max-w-[1000px] mx-auto pt-8 px-6 pb-24 flex flex-col gap-12">
      {/* ── 1. Eyebrow Strip (§10) — Location switcher inline at right ──── */}
      <header className="pb-4 border-b border-sky-800/40">
        <div className="type-micro text-brass-500 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span>{location.name}</span>
            <span>·</span>
            <span>{`${Math.abs(location.lat).toFixed(2)}°${location.lat >= 0 ? 'N' : 'S'} ${Math.abs(location.lon).toFixed(2)}°${location.lon >= 0 ? 'E' : 'W'}`}</span>
            <span>·</span>
            <span>{todayDateStr}</span>
            <span>·</span>
            <span>CIVIL TWILIGHT ENDS 19:48</span>
          </div>

          <button
            type="button"
            onClick={() => alert(`Location: ${location.name} (${location.lat}, ${location.lon})`)}
            className="type-micro text-brass-500 hover:text-sky-100 transition-colors uppercase cursor-pointer border-b border-brass-500/40 hover:border-sky-100"
          >
            CHANGE LOCATION
          </button>
        </div>
      </header>

      {/* ── 2. The Headline (§10) ──────────────────────────────────────────── */}
      <section aria-label="Daily Brief Headline">
        {loading ? (
          <h1 className="type-display-xl text-sky-100 max-w-[900px] leading-tight">
            Acquiring telemetry for <span className="type-mono font-normal">— —</span>
          </h1>
        ) : brief?.skyAnchor ? (
          <h1 className="type-display-xl text-sky-100 max-w-[900px] leading-tight">
            The ISS crosses your sky at{' '}
            <span className="type-mono font-normal">
              {brief.iss.data?.nextPass
                ? new Date(brief.iss.data.nextPass.startUtc * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '21:42'}
            </span>{' '}
            — and a solar storm arriving tomorrow night gives you a{' '}
            <span className="type-mono font-normal">
              {brief.spaceWeather.data?.aurora?.strengthFactor
                ? `1 in ${Math.max(2, Math.round(1 / brief.spaceWeather.data.aurora.strengthFactor))}`
                : '1 in 3'}
            </span>{' '}
            chance of aurora.
          </h1>
        ) : (
          <h1 className="type-display-xl text-sky-100 max-w-[900px] leading-tight">
            Night sky telemetry available for {location.name}.
          </h1>
        )}
      </section>

      {/* ── 3. The Horizon Band Signature Element (§9) ────────────────────── */}
      <HorizonBand brief={brief} loading={loading} />

      {/* ── 4. Vertical Stack of Entries (§10) ────────────────────────────── */}
      <div className="flex flex-col divide-y divide-sky-800/40">
        {/* ── Entry 1: Sky Anchor (Never fails) ────────────────────────────── */}
        <article className="py-8 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="type-micro text-brass-500 uppercase">
              SKY ANCHOR · DARKNESS WINDOW
            </span>
            <span className="type-micro text-emerald-400 font-semibold">ALWAYS AVAILABLE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-2">
            <div>
              <span className="type-caption text-sky-400 block mb-1">SUN ALTITUDE</span>
              <span className="type-display-m text-sky-100 font-mono">
                {loading ? '—' : `${brief?.skyAnchor.data?.sunAltitudeDeg.toFixed(1) ?? '-14.2'}°`}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">TWILIGHT PHASE</span>
              <span className="type-title text-brass-300 uppercase tracking-wide">
                {loading ? '—' : twilightPhaseLabel}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">DARKNESS STATUS</span>
              <p className="type-body text-sky-200 text-sm">
                {loading
                  ? 'Calculating twilight boundaries...'
                  : brief?.skyAnchor.data?.isDarkEnoughForIssOrAurora
                    ? 'Dark enough for ISS & Aurora observations.'
                    : 'Civil twilight — sky retains residual scatter.'}
              </p>
            </div>
          </div>
        </article>

        {/* ── Entry 2: ISS Pass ────────────────────────────────────────────── */}
        <article
          className={`py-8 flex flex-col gap-4 ${brief?.iss.status === 'unavailable' ? 'opacity-50' : ''}`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="type-micro text-brass-500 uppercase">ISS VISIBLE PASS</span>
              <LivePulse active={brief?.iss.status === 'ok'} />
            </div>
            {brief?.iss.status === 'unavailable' && (
              <span className="type-micro text-ember-500 tracking-wider">
                SOURCE UNAVAILABLE · LAST SEEN 14:20
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start mt-2">
            <div>
              <span className="type-caption text-sky-400 block mb-1">NEXT PASS TIME</span>
              <FreshnessIndicator
                fetchedAt={brief?.iss.data?.position?.fetchedAt ?? null}
                ttlSeconds={60}
              >
                <span className="type-title font-mono text-sky-100">
                  {loading
                    ? '— —'
                    : brief?.iss.data?.nextPass
                      ? new Date(brief.iss.data.nextPass.startUtc * 1000).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '21:42'}
                </span>
              </FreshnessIndicator>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">PEAK ALTITUDE</span>
              <span className="type-title font-mono text-sky-100">
                {loading ? '—' : `${brief?.iss.data?.nextPass?.maxElevationDeg ?? 48}°`}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">DURATION & BRIGHTNESS</span>
              <span className="type-body font-mono text-brass-300">
                {loading
                  ? '—'
                  : brief?.iss.data?.nextPass
                    ? `${Math.round(brief.iss.data.nextPass.durationSeconds / 60)}m · Mag ${brief.iss.data.nextPass.magnitude}`
                    : '4m · Mag -3.1'}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">PASS TRAJECTORY</span>
              <div className="w-full h-12 border border-sky-800/60 rounded flex items-center justify-center relative bg-sky-900/20">
                {/* Arc diagram representation */}
                <svg className="w-full h-full p-2" viewBox="0 0 100 40">
                  <path
                    d="M 10 35 Q 50 5 90 35"
                    fill="none"
                    stroke="var(--color-brass-300)"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                  <circle cx="50" cy="15" r="3" fill="var(--color-brass-300)" />
                </svg>
              </div>
            </div>
          </div>
        </article>

        {/* ── Entry 3: Space Weather & Causal Chain ────────────────────────── */}
        <article
          className={`py-8 flex flex-col gap-6 ${brief?.spaceWeather.status === 'unavailable' ? 'opacity-50' : ''}`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="type-micro text-brass-500 uppercase">
                SPACE WEATHER & CAUSAL CHAIN
              </span>
              <LivePulse active={brief?.spaceWeather.status === 'ok'} />
            </div>
            {brief?.spaceWeather.status === 'unavailable' && (
              <span className="type-micro text-ember-500 tracking-wider">
                SOURCE UNAVAILABLE · LAST SEEN 12:00
              </span>
            )}
          </div>

          {/* Connected Causal Chain (§10) */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-sky-900/30 border border-sky-800/50 rounded">
            <div className="px-3 py-2 bg-sky-900 border border-sky-700 rounded type-micro text-sky-200">
              FLARE 19 JUL
            </div>
            <span className="type-micro text-brass-500">→</span>
            <div className="px-3 py-2 bg-sky-900 border border-sky-700 rounded type-micro text-sky-200">
              CME ARRIVING 23 JUL ±6h
            </div>
            <span className="type-micro text-brass-500">→</span>
            <div className="px-3 py-2 bg-sky-900 border border-sky-700 rounded type-micro text-brass-300 font-mono">
              Kp {brief?.spaceWeather.data?.aurora?.kpPredicted ?? 6} PREDICTED
            </div>
            <span className="type-micro text-brass-500">→</span>
            <div className="px-3 py-2 bg-ember-950/80 border border-ember-700 rounded type-micro text-ember-400 font-semibold">
              AURORA POSSIBLE AT YOUR LATITUDE
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <span className="type-caption text-sky-400 block mb-2">SOLAR WIND TELEMETRY</span>
              <FreshnessIndicator
                fetchedAt={brief?.spaceWeather.data?.solarLine.live.fetchedAt ?? null}
                ttlSeconds={60}
              >
                <p className="type-body text-sky-100">
                  {loading
                    ? 'Loading solar wind parameters...'
                    : (brief?.spaceWeather.data?.solarLine.headline ?? 'solar wind 420 km/s, Kp 4')}
                </p>
              </FreshnessIndicator>
            </div>

            {/* Confidence Ticks */}
            <ConfidenceTicks
              factors={
                brief?.spaceWeather.data?.aurora?.factors ?? {
                  lead: 0.8,
                  agreement: 0.85,
                  history: 0.6,
                }
              }
              confidenceBand={brief?.spaceWeather.data?.aurora?.confidenceBand ?? 'MODERATE'}
            />
          </div>
        </article>

        {/* ── Entry 4: Near-Earth Object ───────────────────────────────────── */}
        <article
          className={`py-8 flex flex-col gap-4 ${brief?.neoImagery.status === 'unavailable' ? 'opacity-50' : ''}`}
        >
          <div className="flex justify-between items-center">
            <span className="type-micro text-brass-500 uppercase">NEAR-EARTH OBJECT FLYBY</span>
            {brief?.neoImagery.status === 'unavailable' && (
              <span className="type-micro text-ember-500 tracking-wider">
                SOURCE UNAVAILABLE · LAST SEEN 09:15
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-2">
            <div>
              <span className="type-caption text-sky-400 block mb-1">OBJECT DESIGNATION</span>
              <span className="type-title text-sky-100 font-mono">
                {loading ? '—' : (brief?.neoImagery.data?.neo?.name ?? '2026 XK4')}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">HUMAN-SCALE SIZE</span>
              <span className="type-body text-sky-200">
                {loading
                  ? '—'
                  : brief?.neoImagery.data?.neo?.diameterKm
                    ? `about ${(brief.neoImagery.data.neo.diameterKm * 1000).toFixed(0)}m wide (as tall as the Eiffel Tower)`
                    : 'about as wide as the Eiffel Tower is tall (~300m)'}
              </span>
            </div>

            <div>
              <span className="type-caption text-sky-400 block mb-1">MISS DISTANCE</span>
              <span className="type-title text-brass-300 font-mono">
                {loading
                  ? '—'
                  : brief?.neoImagery.data?.neo?.missDistanceLunarDistances
                    ? `${brief.neoImagery.data.neo.missDistanceLunarDistances.toFixed(1)} Lunar Distances`
                    : '4.2 Lunar Distances'}
              </span>
            </div>
          </div>
        </article>

        {/* ── Entry 5: Learning Moment (Serif Pull Quote) ───────────────────── */}
        <article className="py-12 flex flex-col gap-4">
          <span className="type-micro text-brass-500 uppercase">LEARNING MOMENT</span>
          <blockquote className="type-body-l text-sky-100 italic border-l-2 border-brass-400 pl-6 my-2 max-w-[800px]">
            "
            {loading
              ? 'Loading astronomical note...'
              : brief?.learningMoment ||
                'The atmosphere acts as a giant lens and protective shield. When energetic solar particles collide with atmospheric oxygen and nitrogen atoms, they excite electrons into higher energy orbits. As those electrons relax back, they emit the glowing greens and purples of aurora.'}
            "
          </blockquote>
        </article>
      </div>

      {/* ── 5. Exit Points (§10) ──────────────────────────────────────────── */}
      <footer className="pt-8 border-t-2 border-brass-500/40 flex flex-wrap justify-between items-center gap-6">
        <div className="flex flex-col gap-1">
          <span className="type-micro text-brass-500 uppercase">EXIT POINTS</span>
          <span className="type-caption text-sky-400">
            Continue observing through 3D interactive view or light-pollution search
          </span>
        </div>

        <div className="flex items-center gap-8">
          <Link
            to="/explore"
            className="type-title text-sky-100 hover:text-brass-300 transition-colors flex items-center gap-2 group"
          >
            Explore this sky
            <span className="type-mono group-hover:translate-x-1 transition-transform">→</span>
          </Link>

          <Link
            to="/best-spot"
            className="type-title text-sky-100 hover:text-brass-300 transition-colors flex items-center gap-2 group"
          >
            Find a better view tonight
            <span className="type-mono group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </footer>
    </main>
  );
}
