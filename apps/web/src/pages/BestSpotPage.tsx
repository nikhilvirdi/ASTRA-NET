import React, { useEffect, useState } from 'react';
import {
  fetchBestSpot,
  getEffectiveLocation,
  type BestSpotEventFilter,
  type BestSpotPayload,
} from '@/lib/api';
import { ScoreBreakdown } from '@/components/best-spot/ScoreBreakdown';
import { MapLibreSpotMap } from '@/components/best-spot/MapLibreSpotMap';
import { formatCompassDistance, getDirectionsUrl } from '@/lib/best-spot-helpers';

export { formatCompassDistance, getDirectionsUrl };

/** BestSpotPage — /best-spot · Best-Spot-Tonight Finder · Phase 9 · DESIGN_SPEC.md §12 */
export function BestSpotPage(): React.ReactElement {
  const location = getEffectiveLocation();
  const [payload, setPayload] = useState<BestSpotPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<BestSpotEventFilter>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchBestSpot(location.lat, location.lon, eventFilter)
      .then((data) => {
        if (!mounted) return;
        setPayload(data);
        setLoading(false);
        if (data.sites.length > 0 && !selectedSiteId) {
          setSelectedSiteId(data.sites[0]!.id);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[BestSpotPage] fetch error:', err);
        setError('Failed to load candidate observation sites.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [location.lat, location.lon, eventFilter, selectedSiteId]);

  const ranking = payload?.ranking;
  const sites = payload?.sites ?? [];
  const clarityAvailable = ranking?.clarityAvailable ?? true;

  return (
    <main
      id="main-content"
      className="pt-16 pb-12 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col min-h-screen"
      aria-label="Best-Spot-Tonight Finder"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-sky-800/40 pb-6 mb-6 gap-4">
        <div>
          <span className="type-micro text-brass-500 uppercase tracking-widest block mb-1">
            EXPLORE · PHASE 9
          </span>
          <h1 className="type-display-l text-sky-100 font-serif">Best Spot Tonight</h1>
          <p className="type-body text-sky-300 text-sm mt-1 max-w-2xl">
            Candidate observation sites within 100 km, ranked by clarity, darkness, and travel
            distance.
          </p>
        </div>

        {/* Event Filter Selector */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-sky-400 uppercase text-caption mr-1">EVENT FILTER:</span>
          {(['all', 'aurora'] as BestSpotEventFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={eventFilter === filter}
              onClick={() => setEventFilter(filter)}
              className={`min-h-[44px] px-3.5 py-2 border uppercase cursor-pointer transition-all flex items-center justify-center ${
                eventFilter === filter
                  ? 'border-brass-300 text-brass-300 bg-brass-300/10 font-bold'
                  : 'border-sky-800 text-sky-400 hover:border-sky-600 hover:text-sky-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Honest Degradation Alert Banner */}
      {!clarityAvailable && !loading && (
        <div className="mb-6 bg-sky-900/60 border-l-2 border-brass-300 p-4 text-xs font-mono text-brass-300 flex items-center justify-between">
          <span>RANKING RUNNING ON DARKNESS & TRAVEL ONLY · CLOUD FORECAST UNAVAILABLE</span>
          <span className="text-sky-400 text-[10px]">REDUCED CONFIDENCE</span>
        </div>
      )}

      {/* Main Split Layout: 40/60 on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">
        {/* Left Column: Ranked Candidate List (40% / 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
          <div className="flex justify-between items-center text-xs font-mono text-sky-400 border-b border-sky-800/40 pb-2">
            <span>RANKED CANDIDATE SITES ({sites.length})</span>
            {payload && (
              <span>
                TARGET:{' '}
                {new Date(payload.targetTime).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                UTC
              </span>
            )}
          </div>

          {loading && (
            <div className="py-12 text-center text-xs font-mono text-sky-400 animate-pulse">
              CALCULATING CANDIDATE SITE SCORES...
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-xs font-mono text-ember-400 bg-sky-950 p-4 border border-ember-400/40">
              {error}
            </div>
          )}

          {!loading && !error && sites.length === 0 && (
            <div className="py-12 text-center text-xs font-mono text-sky-400">
              NO CANDIDATE SITES FOUND WITHIN RANGE.
            </div>
          )}

          {!loading &&
            sites.map((site) => {
              const isSelected = site.id === selectedSiteId;
              const compassDist = formatCompassDistance(site);
              const directionsUrl = getDirectionsUrl(site);

              return (
                <article
                  key={site.id}
                  role="button"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`Site ${site.rank}: ${site.label}, ${compassDist}`}
                  onClick={() => setSelectedSiteId(site.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSiteId(site.id);
                    }
                  }}
                  className={`p-5 border transition-all cursor-pointer flex flex-col gap-3 focus-visible:ring-2 focus-visible:ring-brass-300 focus-visible:outline-none ${
                    isSelected
                      ? 'border-brass-300 bg-sky-950 shadow-2xl ring-1 ring-brass-300/30'
                      : 'border-sky-800/50 bg-sky-950/40 hover:border-sky-600'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-sky-800/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="type-micro text-brass-300 font-mono font-bold">
                        #{site.rank}
                      </span>
                      <span className="type-caption text-sky-100 uppercase tracking-wider font-semibold">
                        {site.label}
                      </span>
                    </div>
                    {/* Compass + Distance string (e.g. "NE 25 km") */}
                    <span className="type-micro text-brass-300 font-mono">{compassDist}</span>
                  </div>

                  {/* Three-Bar Score Breakdown */}
                  <ScoreBreakdown site={site} clarityAvailable={clarityAvailable} />

                  {/* Footer & Directions Link */}
                  <div className="flex items-center justify-between pt-1 text-xs font-mono">
                    <span className="text-sky-400 text-[10px]">
                      {(site.score * 100).toFixed(0)}% MATCH SCORE
                    </span>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="type-micro text-ember-400 hover:text-ember-300 uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                    >
                      DIRECTIONS (LAT/LON) →
                    </a>
                  </div>
                </article>
              );
            })}
        </div>

        {/* Right Column: MapLibre GL Spot Map (60% / 7 cols) */}
        <div className="lg:col-span-7 h-[450px] lg:h-[calc(100vh-220px)] sticky top-20 border border-sky-800/50 order-1 lg:order-2 overflow-hidden shadow-2xl">
          <MapLibreSpotMap
            observer={{ latDeg: location.lat, lonDeg: location.lon }}
            sites={sites}
            selectedSiteId={selectedSiteId}
            onSelectSite={(id) => setSelectedSiteId(id)}
          />
        </div>
      </div>
    </main>
  );
}
