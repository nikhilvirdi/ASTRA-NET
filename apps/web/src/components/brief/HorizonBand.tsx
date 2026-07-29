import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyBrief } from '@/lib/api';
import { interpolatePassPosition } from '@/lib/pass-interpolation';
import {
  COMPASS_POINTS,
  belongsOnBand,
  compassPointLeftPercent,
  formatAltitude,
  markerBandPosition,
} from '@/lib/horizon-band';

export interface HorizonBandMarker {
  id: string;
  label: string;
  sublabel: string;
  type: 'iss' | 'sun' | 'jupiter' | 'neo' | 'aurora' | 'moon' | 'planet';
  azimuthDeg: number;
  altitudeDeg: number;
  colorClass?: string;
  available?: boolean;
}

interface HorizonBandProps {
  brief?: DailyBrief | null;
  markers?: HorizonBandMarker[];
  loading?: boolean;
  hideScrubber?: boolean;
}

interface MarkerItem {
  id: string;
  label: string;
  sublabel: string;
  type: 'iss' | 'sun' | 'jupiter' | 'neo' | 'aurora' | 'moon' | 'planet';
  azimuthDeg: number;
  altitudeDeg: number;
  colorClass: string;
  available: boolean;
}

export function HorizonBand({
  brief = null,
  markers: customMarkers,
  loading,
  hideScrubber = false,
}: HorizonBandProps): React.ReactElement {
  const navigate = useNavigate();
  const [scrubHours, setScrubHours] = useState<number>(0);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerItem | null>(null);

  // Calculate current effective time (now + scrubHours)
  const baseTime = useMemo(() => {
    return brief?.generatedAt ? new Date(brief.generatedAt) : new Date();
  }, [brief?.generatedAt]);

  const effectiveTime = useMemo(() => {
    return new Date(baseTime.getTime() + scrubHours * 3600 * 1000);
  }, [baseTime, scrubHours]);

  // Compute marker positions
  const markers = useMemo<MarkerItem[]>(() => {
    // If custom markers array is passed (e.g. from ShareSnapshot), use it directly
    // through the exact same belongsOnBand real culling filter.
    if (customMarkers && customMarkers.length > 0) {
      return customMarkers
        .filter((m) => belongsOnBand(m.altitudeDeg))
        .map((m) => {
          let colorClass = m.colorClass;
          if (!colorClass) {
            switch (m.type) {
              case 'sun':
                colorClass = 'bg-solar';
                break;
              case 'iss':
                colorClass = 'bg-orbital';
                break;
              case 'moon':
                colorClass = 'bg-sky-100';
                break;
              case 'neo':
                colorClass = 'bg-amber-400';
                break;
              case 'aurora':
                colorClass = 'bg-aurora';
                break;
              case 'jupiter':
              case 'planet':
              default:
                colorClass = 'bg-brass-300';
                break;
            }
          }
          return {
            id: m.id,
            label: m.label,
            sublabel: m.sublabel,
            type: m.type,
            azimuthDeg: m.azimuthDeg,
            altitudeDeg: m.altitudeDeg,
            colorClass,
            available: m.available ?? true,
          };
        });
    }

    const list: MarkerItem[] = [];

    // 1. Sun — omitted entirely when below the horizon. The band answers
    // "where do I look?", and a Sun 14deg down is not an answer to that.
    // It used to be pushed unconditionally and then clamped to the horizon
    // rule by getCoords, which drew it as though it were rising.
    const sunAnchor = brief?.skyAnchor?.data ?? null;
    if (sunAnchor && belongsOnBand(sunAnchor.sunAltitudeDeg)) {
      list.push({
        id: 'sun',
        label: 'SUN',
        sublabel: formatAltitude(sunAnchor.sunAltitudeDeg),
        type: 'sun',
        // Real azimuth. This was hardcoded to 180 (due south) with a comment
        // saying skyAnchor did not provide it — it does, and has since the
        // Sun engine started returning sunAzimuthDeg alongside the altitude.
        azimuthDeg: sunAnchor.sunAzimuthDeg,
        altitudeDeg: sunAnchor.sunAltitudeDeg,
        colorClass: 'bg-solar',
        available: true,
      });
    }

    // 2. ISS Position — interpolated along the next visible pass's own
    // timeline (start → max → end); no marker outside the pass window. The
    // full rationale lives with the shared implementation in
    // `@/lib/pass-interpolation` — note the scrub time moves along the pass's
    // timeline, not linearly across the scrubber's full ±6h range.
    const pass = brief?.iss?.status === 'ok' ? (brief.iss.data?.nextPass ?? null) : null;
    if (pass) {
      const pos = interpolatePassPosition(pass, effectiveTime.getTime() / 1000);
      if (pos && belongsOnBand(pos.altitudeDeg)) {
        list.push({
          id: 'iss',
          label: 'ISS',
          sublabel: `Pass ${new Date(pass.startUtc * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          type: 'iss',
          azimuthDeg: pos.azimuthDeg,
          altitudeDeg: pos.altitudeDeg,
          colorClass: 'bg-orbital',
          available: true,
        });
      }
    }

    // 3. Jupiter (Representative bright planet marker). Three fabrications
    // removed here: it was admitted down to -10deg, its sublabel reported
    // `Math.max(0, alt)` so a Jupiter at -5deg read "Alt 0°", and it was
    // drawn at `Math.max(2, alt)` — a position it was not in. Same defect
    // class as the altitude floor stripped from the Explore scene in
    // c2acb7f, and now culled by the same isAboveHorizon.
    const jupiter = brief?.skyAnchor?.data?.jupiter ?? null;
    if (jupiter && belongsOnBand(jupiter.altitudeDeg)) {
      list.push({
        id: 'jupiter',
        label: 'JUPITER',
        sublabel: formatAltitude(jupiter.altitudeDeg),
        type: 'jupiter',
        azimuthDeg: jupiter.azimuthDeg,
        altitudeDeg: jupiter.altitudeDeg,
        colorClass: 'bg-brass-300',
        available: true,
      });
    }

    return list;
  }, [effectiveTime, brief, customMarkers]);

  // Degraded unavailable notices
  const unavailableNotes: string[] = [];
  if (brief && brief.iss.status === 'unavailable') {
    unavailableNotes.push('ISS · POSITION UNAVAILABLE');
  }
  if (brief && brief.spaceWeather.status === 'unavailable') {
    unavailableNotes.push('AURORA · FORECAST UNAVAILABLE');
  }
  if (brief && brief.neoImagery.status === 'unavailable') {
    unavailableNotes.push('NEO · DATA UNAVAILABLE');
  }

  // Azimuth/altitude to band percentages. Markers are culled above by
  // belongsOnBand, so the clamp inside only absorbs the sub-degree
  // refraction sliver rather than relocating a below-horizon body.
  const getCoords = (az: number, alt: number) => {
    const { leftPercent, topPercent } = markerBandPosition(az, alt);
    return { x: `${leftPercent.toFixed(2)}%`, y: `${topPercent.toFixed(2)}%` };
  };

  return (
    <section aria-label="The Horizon Band" className="w-full my-12 flex flex-col gap-3">
      {/* Visual Band Header / Title */}
      <div className="flex justify-between items-baseline px-1">
        <span className="type-micro text-brass-500 tracking-wider uppercase">
          HORIZON BAND · LOCAL FIELD OF VIEW
        </span>
        {!hideScrubber && (
          <span className="type-micro text-sky-400">
            {scrubHours === 0
              ? 'LIVE (NOW)'
              : `${scrubHours > 0 ? '+' : ''}${scrubHours.toFixed(1)}h FROM NOW`}
          </span>
        )}
      </div>

      {/* Main 180px Band Container */}
      <div className="relative w-full h-[180px] bg-transparent overflow-hidden select-none border-b-2 border-sky-600">
        {/* Zenith line (top faint guide) */}
        <div className="absolute top-2 left-0 right-0 border-t border-dashed border-sky-800/40 text-[10px] text-brass-500/60 pl-2">
          ZENITH (90°)
        </div>

        {/* 45° Altitude guide line */}
        <div className="absolute top-[50%] left-0 right-0 border-t border-dashed border-sky-800/30 text-[10px] text-brass-500/40 pl-2">
          45° ALTITUDE
        </div>

        {/* Aurora Glow Band if visible */}
        {brief?.spaceWeather?.data?.aurora?.visible && (
          <div
            className="absolute bottom-0 left-0 w-[40%] h-[45px] pointer-events-none opacity-40 blur-md"
            style={{ background: 'linear-gradient(to top, var(--color-aurora), transparent)' }}
          />
        )}

        {/* Skeleton loading dashes */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="type-mono text-brass-500 text-sm tracking-widest animate-pulse">
              — — HORIZON ACQUIRING — —
            </span>
          </div>
        )}

        {/* Markers */}
        {!loading &&
          markers.map((m) => {
            const coords = getCoords(m.azimuthDeg, m.altitudeDeg);
            const isHovered = hoveredMarker?.id === m.id;

            return (
              <div
                key={m.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: coords.x, top: coords.y }}
                onMouseEnter={() => setHoveredMarker(m)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={() => navigate('/explore')}
                role="button"
                tabIndex={0}
                aria-label={`${m.label}: ${m.sublabel}`}
              >
                {/* Hover Tether Line */}
                {isHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 w-[1px] bg-brass-300/80 pointer-events-none mb-1"
                    style={{ height: '40px' }}
                  />
                )}

                {/* Hover Label */}
                {isHovered && (
                  <div className="absolute bottom-[calc(100%+44px)] left-1/2 -translate-x-1/2 whitespace-nowrap bg-sky-900 border border-sky-700 px-2 py-1 rounded text-xs shadow-lg z-20 pointer-events-none">
                    <div className="type-micro font-semibold text-sky-100">{m.label}</div>
                    <div className="type-caption text-brass-400 text-[11px]">{m.sublabel}</div>
                  </div>
                )}

                {/* Marker Dot */}
                <div
                  className={`w-3 h-3 rounded-full border border-sky-100 transition-transform duration-150 ${
                    isHovered ? 'scale-150 ring-2 ring-brass-300' : 'group-hover:scale-125'
                  } ${m.colorClass}`}
                />

                {/* Inline label below dot */}
                <span className="type-micro text-[10px] text-sky-300 opacity-80 block text-center mt-1">
                  {m.label}
                </span>
              </div>
            );
          })}

        {/* Horizon Rule (Heavy 2px bottom line) */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-600 z-0" />
      </div>

      {/* Compass axis — each mark positioned from its real azimuth, not
          spaced evenly by flexbox, so the marks line up with the markers
          above them. */}
      <div className="relative w-full h-5 border-t border-sky-800/40">
        {COMPASS_POINTS.map((point) => (
          <div
            key={point.label}
            className="absolute top-0 flex flex-col items-center -translate-x-1/2"
            style={{ left: `${compassPointLeftPercent(point.deg).toFixed(2)}%` }}
          >
            <div className="w-[1px] h-1.5 bg-brass-500/60" />
            <span className="type-micro text-[10px] text-brass-500 tracking-wider">
              {point.label}
            </span>
          </div>
        ))}
      </div>

      {/* Time Scrubber */}
      {!hideScrubber && (
        <div className="flex items-center gap-4 mt-2 px-1">
          <span className="type-micro text-brass-500 text-[11px] min-w-[55px]">TIME SCRUB</span>
          <input
            type="range"
            min="-6"
            max="6"
            step="0.1"
            value={scrubHours}
            onChange={(e) => setScrubHours(parseFloat(e.target.value))}
            onMouseUp={() => setScrubHours(0)}
            onTouchEnd={() => setScrubHours(0)}
            aria-label="Time scrubber (drag to move across night, release to snap back to now)"
            className="w-full accent-brass-400 cursor-pointer h-1.5 bg-sky-800 rounded appearance-none"
          />
          <button
            type="button"
            onClick={() => setScrubHours(0)}
            className="type-micro text-xs text-brass-400 hover:text-sky-100 transition-colors px-2 py-0.5 border border-sky-700/50 rounded"
          >
            NOW
          </button>
        </div>
      )}

      {/* Degraded margin notes */}
      {unavailableNotes.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 px-1">
          {unavailableNotes.map((note, i) => (
            <span key={i} className="type-micro text-[11px] text-ember-500 tracking-wide">
              {note}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
