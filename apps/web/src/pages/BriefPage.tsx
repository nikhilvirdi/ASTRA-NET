import React, { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { twilightStateForSunAltitude } from '@astranet/shared';
import { fetchBrief, DEFAULT_OBSERVER_LOCATION, type DailyBrief } from '@/lib/api';
import { useAppStore } from '@/store';
import { HorizonBand } from '@/components/brief/HorizonBand';
import { SunAltitudeGauge } from '@/components/brief/SunAltitudeGauge';
import { MoonPhaseGraphic } from '@/components/brief/MoonPhaseGraphic';
import { MoonTimeline } from '@/components/brief/MoonTimeline';
import { IssElevationGauge } from '@/components/brief/IssElevationGauge';
import { IssTrajectoryArc } from '@/components/brief/IssTrajectoryArc';
import { CausalChainFlow } from '@/components/brief/CausalChainFlow';
import { SolarWindTelemetry } from '@/components/brief/SolarWindTelemetry';
import { spaceWeatherUiState, formatLastSeen } from '@/lib/space-weather-status';
import { FreshnessIndicator } from '@/components/common/FreshnessIndicator';
import { ConfidenceTicks } from '@/components/common/ConfidenceTicks';

const Hero = lazy(() => import('@/components/brief/Hero'));

interface WordToken {
  text: string;
  className?: string;
}

function extractWordTokens(node: React.ReactNode, inheritedClassName?: string): WordToken[] {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, className: inheritedClassName }));
  }
  if (Array.isArray(node)) {
    const children = node as React.ReactNode[];
    return children.flatMap((child: React.ReactNode) =>
      extractWordTokens(child, inheritedClassName),
    );
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = [inheritedClassName, element.props.className].filter(Boolean).join(' ');
    if (element.props.children !== undefined) {
      return extractWordTokens(element.props.children, className || undefined);
    }
  }
  return [];
}

const headlineContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const headlineWordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: 'easeOut',
    },
  },
};

function AnimatedHeadline({ children }: { children: React.ReactNode }): React.ReactElement {
  const tokens = useMemo(() => extractWordTokens(children), [children]);

  return (
    <motion.h1
      className="type-display-l text-sky-100 max-w-[900px] leading-tight"
      variants={headlineContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {tokens.map((token, index) => (
        <motion.span
          key={`${token.text}-${index}`}
          variants={headlineWordVariants}
          className={`inline-block mr-[0.28em] ${token.className ?? ''}`}
        >
          {token.text}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function formatMoonPhase(phaseName: string): string {
  return phaseName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toUpperCase();
}

export function BriefPage(): React.ReactElement {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reactive (not `getEffectiveLocation()`'s one-shot read): the site-wide
  // location switcher below writes here, and every consumer of this store
  // slot — this page, Explore, Best-Spot — needs to re-render when it does.
  const storeLocation = useAppStore((s) => s.location);
  const location = storeLocation ?? DEFAULT_OBSERVER_LOCATION;

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

  // Dimming, live pulse and status notice for the space-weather section.
  // Derived in one place so the three cannot disagree — they did: the pulse
  // was driven by `status === 'ok'` alone and lit through a total outage.
  const spaceWeatherUi = spaceWeatherUiState(brief?.spaceWeather ?? null);

  // Twilight state calculation
  const sunAltDeg = brief?.skyAnchor.data?.sunAltitudeDeg ?? -14.2;
  const twilightState = twilightStateForSunAltitude(sunAltDeg);
  const twilightPhaseLabel =
    twilightState.phase === 'day'
      ? 'DAYLIGHT'
      : twilightState.phase === 'night'
        ? 'NIGHT'
        : `${twilightState.phase.toUpperCase()} TWILIGHT`;

  // Compose Headline
  let composedHeadline: React.ReactNode = 'No active aurora prediction or ISS pass expected soon.';
  if (brief?.skyAnchor) {
    const issPass = brief.iss.data?.nextPass;
    const auroraStrength = brief.spaceWeather.data?.aurora?.strengthFactor;

    let issText = '';
    let issNode: React.ReactNode = null;
    if (issPass) {
      const timeStr = new Date(issPass.startUtc * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      issText = `The ISS crosses your sky at ${timeStr}`;
      issNode = (
        <>
          The ISS crosses your sky at <span className="type-mono font-normal">{timeStr}</span>
        </>
      );
    }

    let auroraText = '';
    let auroraNode: React.ReactNode = null;
    let auroraNodeCap: React.ReactNode = null;
    if (auroraStrength) {
      const ratio = Math.max(2, Math.round(1 / auroraStrength));
      auroraText = `a solar storm gives you a 1 in ${ratio} chance of aurora`;
      auroraNode = (
        <>
          a solar storm gives you a <span className="type-mono font-normal">1 in {ratio}</span>{' '}
          chance of aurora
        </>
      );
      auroraNodeCap = (
        <>
          A solar storm gives you a <span className="type-mono font-normal">1 in {ratio}</span>{' '}
          chance of aurora
        </>
      );
    }

    if (issText && auroraText) {
      const combinedLength = issText.length + 7 + auroraText.length + 1; // " — and " + "."
      // Display-xl max 2 lines at 900px is roughly 90-100 characters.
      if (combinedLength > 95) {
        composedHeadline = <>{issNode}.</>;
      } else {
        composedHeadline = (
          <>
            {issNode} — and {auroraNode}.
          </>
        );
      }
    } else if (issText) {
      composedHeadline = <>{issNode}.</>;
    } else if (auroraText) {
      composedHeadline = <>{auroraNodeCap}.</>;
    }
  }

  if (error) {
    return (
      <>
        <Suspense fallback={<div className="w-full min-h-[100vh] bg-[#000000]" />}>
          <Hero />
        </Suspense>
        <main
          id="main-content"
          className="max-w-[1200px] mx-auto pt-8 px-8 pb-24 flex flex-col gap-12"
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
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="w-full min-h-[100vh] bg-[#000000]" />}>
        <Hero />
      </Suspense>
      <main
        id="main-content"
        className="max-w-[1200px] mx-auto pt-8 px-8 pb-24 flex flex-col gap-12"
      >
        {/* ── 2. The Headline (§10) ──────────────────────────────────────────── */}
        <section aria-label="Daily Brief Headline">
          {loading ? (
            <AnimatedHeadline key="loading">
              Acquiring telemetry for <span className="type-mono font-normal">— —</span>
            </AnimatedHeadline>
          ) : brief?.skyAnchor ? (
            <AnimatedHeadline key="headline">{composedHeadline}</AnimatedHeadline>
          ) : (
            <AnimatedHeadline key="fallback">
              Night sky telemetry available for {location.name}.
            </AnimatedHeadline>
          )}
        </section>

        {/* ── 3. The Horizon Band Signature Element (§9) ────────────────────── */}
        <HorizonBand brief={brief} loading={loading} />

        {/* ── 4. Vertical Stack of Entries (§10) ────────────────────────────── */}
        <div className="flex flex-col divide-y divide-sky-800/40">
          {/* ── Entry 1: Sky Anchor (Never fails) ────────────────────────────── */}
          <article className="py-8 flex flex-col gap-6">
            <div className="flex justify-between items-baseline">
              <h2 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
                Sky Anchor
              </h2>
              {brief?.skyAnchor?.status === 'unavailable' ? (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-ember-400">
                  HALTED
                </span>
              ) : (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-aurora">
                  LIVE
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Sun Altitude Radial Gauge */}
              <SunAltitudeGauge
                altitudeDeg={brief?.skyAnchor.data?.sunAltitudeDeg}
                loading={loading}
              />

              {/* Twilight Phase */}
              <div>
                <span className="type-caption text-sky-400 block mb-1">TWILIGHT PHASE</span>
                <span className="type-title text-brass-300 uppercase tracking-wide">
                  {loading ? '—' : twilightPhaseLabel}
                </span>
              </div>

              {/* Darkness Status */}
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

            {/* Moon Row: Visual Moon Phase & 24h Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-2">
              {/* Moon Phase with SVG graphic */}
              <div className="flex items-center gap-3">
                {brief?.skyAnchor.data?.moon && (
                  <MoonPhaseGraphic
                    illuminatedFraction={brief.skyAnchor.data.moon.illuminatedFraction}
                    phaseAngleDeg={brief.skyAnchor.data.moon.phaseAngleDeg}
                    phaseName={brief.skyAnchor.data.moon.phaseName}
                    size={48}
                  />
                )}
                <div>
                  <span className="type-caption text-sky-400 block mb-0.5">MOON PHASE</span>
                  <span className="type-title text-sky-100 font-mono uppercase text-base sm:text-lg">
                    {loading || !brief?.skyAnchor.data?.moon
                      ? '—'
                      : `${formatMoonPhase(brief.skyAnchor.data.moon.phaseName)} (${(brief.skyAnchor.data.moon.illuminatedFraction * 100).toFixed(0)}%)`}
                  </span>
                </div>
              </div>

              {/* Moonrise / Moonset Timeline across 2 columns */}
              <div className="md:col-span-2">
                <MoonTimeline
                  nextRiseUtc={brief?.skyAnchor.data?.moon?.nextRiseUtc}
                  nextSetUtc={brief?.skyAnchor.data?.moon?.nextSetUtc}
                  loading={loading}
                />
              </div>
            </div>
          </article>

          {/* ── Entry 2: ISS Pass ────────────────────────────────────────────── */}
          <article
            className={`py-8 flex flex-col gap-6 ${brief?.iss.status === 'unavailable' ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-baseline">
              <h2 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
                ISS Visible Pass
              </h2>
              {brief?.iss.status === 'unavailable' ? (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-ember-400">
                  {(() => {
                    const ls = formatLastSeen(brief.iss.data?.position?.fetchedAt ?? null);
                    return ls ? `HALTED · LAST SEEN ${ls}` : 'HALTED';
                  })()}
                </span>
              ) : (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-aurora">
                  LIVE
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-sm">
                <span className="font-jost text-sm text-sky-400 animate-pulse">
                  Acquiring orbital pass telemetry for ISS...
                </span>
              </div>
            ) : !brief?.iss.data?.nextPass ? (
              <div className="p-5 bg-sky-950/40 border border-sky-800/50 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="font-jost text-sm text-sky-300">
                  No visible pass in the current 24-hour observation window.
                </span>
                {brief?.iss.data?.position && (
                  <div className="flex items-center gap-4 text-xs font-mono text-sky-400">
                    <span>LAT: {brief.iss.data.position.latitude.toFixed(1)}°</span>
                    <span>LON: {brief.iss.data.position.longitude.toFixed(1)}°</span>
                    <span className="text-brass-400">
                      ALT: {brief.iss.data.position.altitude.toFixed(0)} km
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                <div>
                  <span className="type-caption text-sky-400 block mb-1">NEXT PASS TIME</span>
                  <FreshnessIndicator
                    fetchedAt={brief.iss.data.position?.fetchedAt ?? null}
                    ttlSeconds={60}
                  >
                    <span className="type-title font-mono text-sky-100">
                      {new Date(brief.iss.data.nextPass.startUtc * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </FreshnessIndicator>
                </div>

                <div>
                  <IssElevationGauge maxElevationDeg={brief.iss.data.nextPass.maxElevationDeg} />
                </div>

                <div>
                  <span className="type-caption text-sky-400 block mb-1">
                    DURATION & BRIGHTNESS
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <span className="type-body font-mono text-brass-300">
                      {Math.round(brief.iss.data.nextPass.durationSeconds / 60)}m · Mag{' '}
                      {brief.iss.data.nextPass.magnitude}
                    </span>
                    <div className="w-full max-w-[130px] h-1.5 bg-sky-950 rounded-full border border-sky-800/40 overflow-hidden">
                      <div
                        className="h-full bg-brass-400"
                        style={{
                          width: `${Math.min(100, Math.max(15, (brief.iss.data.nextPass.durationSeconds / 480) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="font-jost text-[10px] text-sky-400 font-medium">
                      {brief.iss.data.nextPass.magnitude <= -2.5
                        ? 'EXCEPTIONAL BRIGHTNESS'
                        : brief.iss.data.nextPass.magnitude <= 0
                          ? 'VERY BRIGHT'
                          : 'MODERATE BRIGHTNESS'}
                    </span>
                  </div>
                </div>

                <div>
                  <IssTrajectoryArc pass={brief.iss.data.nextPass} />
                </div>
              </div>
            )}
          </article>

          {/* ── Entry 3: Space Weather ──────────────────────────────────────── */}
          <article
            className={`py-8 flex flex-col gap-6 ${spaceWeatherUi.dimmed ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-baseline">
              <h2 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
                Space Weather
              </h2>
              {spaceWeatherUi.notice !== null ? (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-ember-400">
                  {spaceWeatherUi.notice}
                </span>
              ) : (
                <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-aurora">
                  LIVE
                </span>
              )}
            </div>

            {/* Connected Causal Chain (§10) */}
            <CausalChainFlow aurora={brief?.spaceWeather.data?.aurora ?? null} loading={loading} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Solar Wind Telemetry with Visual Speed Meter */}
              <SolarWindTelemetry
                speedKmS={brief?.spaceWeather.data?.solarLine.live.speedKmS ?? null}
                kp={brief?.spaceWeather.data?.solarLine.live.kp ?? null}
                forecastKp={brief?.spaceWeather.data?.solarLine.forecast.kp ?? null}
                fetchedAt={brief?.spaceWeather.data?.solarLine.live.fetchedAt ?? null}
                loading={loading}
              />

              {/* Confidence Ticks without raw percentages */}
              <ConfidenceTicks
                factors={brief?.spaceWeather.data?.aurora?.factors ?? null}
                confidenceBand={brief?.spaceWeather.data?.aurora?.confidenceBand ?? null}
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
                <span className="type-micro text-ember-500 tracking-wider">SOURCE UNAVAILABLE</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-2">
              <div>
                <span className="type-caption text-sky-400 block mb-1">OBJECT DESIGNATION</span>
                <span className="type-title text-sky-100 font-mono">
                  {loading || !brief?.neoImagery.data?.neo ? '—' : brief.neoImagery.data.neo.name}
                </span>
              </div>

              <div>
                <span className="type-caption text-sky-400 block mb-1">HUMAN-SCALE SIZE</span>
                <span className="type-body text-sky-200">
                  {loading || !brief?.neoImagery.data?.neo?.diameterKm
                    ? '—'
                    : `about ${(brief.neoImagery.data.neo.diameterKm * 1000).toFixed(0)}m wide (as tall as the Eiffel Tower)`}
                </span>
              </div>

              <div>
                <span className="type-caption text-sky-400 block mb-1">MISS DISTANCE</span>
                <span className="type-title text-brass-300 font-mono">
                  {loading || !brief?.neoImagery.data?.neo?.missDistanceLunarDistances
                    ? '—'
                    : `${brief.neoImagery.data.neo.missDistanceLunarDistances.toFixed(1)} Lunar Distances`}
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
    </>
  );
}
