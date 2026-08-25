import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { twilightStateForSunAltitude, surfaceColorForTwilight } from '@astranet/shared';
import type { DailyBrief } from '@/lib/api';
import { interpolatePassPosition } from '@/lib/pass-interpolation';
import {
  COMPASS_POINTS,
  DEFAULT_SWEEP,
  ULTRAWIDE_BREAKPOINT_PX,
  ULTRAWIDE_SWEEP,
  arcFillPath,
  arcGridlinePath,
  azAltToArcPercent,
  azimuthFraction,
  belongsOnBand,
  formatAltitude,
  type ArcSweep,
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

interface CompassMark {
  label: string;
  deg: number;
  leftPercent: number;
}

/**
 * Small engraved object glyphs (DESIGN_SPEC.md §8.1: "Engraved, not drawn —
 * 1.25px stroke, square terminals, 20px grid... not Feather/Lucide's rounded
 * set"). The redesign brief for this component suggested `lucide-react`, but
 * it isn't an installed dependency here (not in package.json/lockfile) and
 * §8.1 explicitly rejects that rounded icon style for this exact reason —
 * so these use the brief's own named fallback, "simple custom SVG glyphs,"
 * drawn to §8.1's actual spec instead. See DECISIONS.md.
 */
function ObjectGlyph({
  type,
  className,
}: {
  type: MarkerItem['type'];
  className?: string;
}): React.ReactElement {
  const common = {
    viewBox: '0 0 20 20',
    className,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
  };

  switch (type) {
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="4.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={10 + Math.cos(rad) * 6.5}
                y1={10 + Math.sin(rad) * 6.5}
                x2={10 + Math.cos(rad) * 9}
                y2={10 + Math.sin(rad) * 9}
              />
            );
          })}
        </svg>
      );
    case 'moon':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 3a7 7 0 1 0 0 14 5.5 5.5 0 0 1 0-14Z" />
        </svg>
      );
    case 'iss':
      return (
        <svg {...common}>
          <rect x="8" y="8" width="4" height="4" />
          <line x1="1" y1="6" x2="7" y2="6" />
          <line x1="1" y1="10" x2="7" y2="10" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="13" y1="6" x2="19" y2="6" />
          <line x1="13" y1="10" x2="19" y2="10" />
          <line x1="13" y1="14" x2="19" y2="14" />
          <line x1="1" y1="4" x2="1" y2="16" />
          <line x1="19" y1="4" x2="19" y2="16" />
        </svg>
      );
    case 'jupiter':
    case 'planet':
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="4.5" />
          <ellipse cx="10" cy="10" rx="9" ry="2.5" transform="rotate(-20 10 10)" />
        </svg>
      );
    case 'neo':
      return (
        <svg {...common}>
          <path d="M4 9 L8 4 L14 5 L17 10 L14 16 L7 15 L4 12 Z" />
        </svg>
      );
    case 'aurora':
      return (
        <svg {...common}>
          <path d="M2 13 Q6 8 10 13 T18 13" />
          <path d="M2 8 Q6 3 10 8 T18 8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="3.5" />
        </svg>
      );
  }
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

  // §9 / Part V: full 360deg sweep only at the Ultrawide (1920px+) breakpoint,
  // a 240deg window otherwise. Affects which azimuths cull from view, so it
  // has to be a real width check (matchMedia), not a CSS-only breakpoint.
  const [isUltrawide, setIsUltrawide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${ULTRAWIDE_BREAKPOINT_PX}px)`);
    const update = (): void => setIsUltrawide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const sweep: ArcSweep = isUltrawide ? ULTRAWIDE_SWEEP : DEFAULT_SWEEP;

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
        .map((m) => ({
          id: m.id,
          label: m.label,
          sublabel: m.sublabel,
          type: m.type,
          azimuthDeg: m.azimuthDeg,
          altitudeDeg: m.altitudeDeg,
          colorClass: m.colorClass ?? '',
          available: m.available ?? true,
        }));
    }

    const list: MarkerItem[] = [];

    // 1. Sun — omitted entirely when below the horizon. The band answers
    // "where do I look?", and a Sun 14deg down is not an answer to that.
    const sunAnchor = brief?.skyAnchor?.data ?? null;
    if (sunAnchor && belongsOnBand(sunAnchor.sunAltitudeDeg)) {
      list.push({
        id: 'sun',
        label: 'SUN',
        sublabel: formatAltitude(sunAnchor.sunAltitudeDeg),
        type: 'sun',
        azimuthDeg: sunAnchor.sunAzimuthDeg,
        altitudeDeg: sunAnchor.sunAltitudeDeg,
        colorClass: 'text-solar',
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
          colorClass: 'text-orbital',
          available: true,
        });
      }
    }

    // 3. Jupiter (Representative bright planet marker).
    const jupiter = brief?.skyAnchor?.data?.jupiter ?? null;
    if (jupiter && belongsOnBand(jupiter.altitudeDeg)) {
      list.push({
        id: 'jupiter',
        label: 'JUPITER',
        sublabel: formatAltitude(jupiter.altitudeDeg),
        type: 'jupiter',
        azimuthDeg: jupiter.azimuthDeg,
        altitudeDeg: jupiter.altitudeDeg,
        colorClass: 'text-brass-300',
        available: true,
      });
    }

    return list;
  }, [effectiveTime, brief, customMarkers]);

  // Degraded unavailable notices & halted status
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
  const isHalted = Boolean(
    brief &&
    (brief.skyAnchor?.status === 'unavailable' ||
      brief.iss?.status === 'unavailable' ||
      unavailableNotes.length > 0),
  );

  // §9: "twilight-phase gradient... reflecting the actual current twilight
  // state" — the real, live Sun altitude, not the scrub position (the
  // gradient reads "actual current," never a hypothetical scrubbed sky).
  const currentSunAltDeg = brief?.skyAnchor?.data?.sunAltitudeDeg ?? null;
  const twilightValue =
    currentSunAltDeg === null ? 3 : twilightStateForSunAltitude(currentSunAltDeg).value;
  const zenithFillColor = surfaceColorForTwilight(twilightValue);
  const horizonFillColor = surfaceColorForTwilight(Math.max(0, twilightValue - 1.2));

  const gridline0 = useMemo(() => arcGridlinePath(0), []);
  const gridline45 = useMemo(() => arcGridlinePath(45), []);
  const gridline90 = useMemo(() => arcGridlinePath(90), []);
  const fillPath = useMemo(() => arcFillPath(), []);

  const compassMarks = useMemo(
    () =>
      COMPASS_POINTS.map((point) => {
        const f = azimuthFraction(point.deg, sweep);
        return { ...point, leftPercent: f === null ? null : f * 100 };
      }).filter((point): point is CompassMark => point.leftPercent !== null),
    [sweep],
  );

  return (
    <section aria-label="The Horizon Band" className="w-full flex flex-col gap-3">
      {/* Visual Band Header / Title */}
      <div className="flex justify-between items-baseline px-1">
        <h2 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
          Horizon Band
        </h2>
        {!hideScrubber &&
          (isHalted ? (
            <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-ember-400">
              HALTED
            </span>
          ) : (
            <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-aurora">
              {scrubHours === 0 ? 'LIVE' : `${scrubHours > 0 ? '+' : ''}${scrubHours.toFixed(1)}h`}
            </span>
          ))}
      </div>

      {/* Dome arc container */}
      <div className="relative w-full h-[200px] sm:h-[240px] lg:h-[280px] select-none">
        <svg
          viewBox={`0 0 1000 260`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="horizon-band-twilight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={zenithFillColor} stopOpacity={0.5} />
              <stop offset="100%" stopColor={horizonFillColor} stopOpacity={0.85} />
            </linearGradient>
          </defs>

          {/* Twilight-phase gradient fill, real not decorative — §9 */}
          <path d={fillPath} fill="url(#horizon-band-twilight)" stroke="none" />

          {/* Faint 90deg (zenith) and 45deg gridline arcs */}
          <path
            d={gridline90}
            fill="none"
            stroke="var(--color-sky-400)"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
          <path
            d={gridline45}
            fill="none"
            stroke="var(--color-sky-400)"
            strokeOpacity={0.25}
            strokeWidth={1}
          />

          {/* Horizon-arc — the heaviest line in the product, §9 */}
          <path d={gridline0} fill="none" stroke="var(--color-sky-400)" strokeWidth={2} />

          <text
            x="500"
            y="22"
            textAnchor="middle"
            className="font-jost fill-white font-medium"
            style={{ fontSize: '12px', letterSpacing: '0.05em', opacity: 0.95 }}
          >
            ZENITH 90°
          </text>
          <text
            x="500"
            y="95"
            textAnchor="middle"
            className="font-jost fill-white font-medium"
            style={{ fontSize: '12px', letterSpacing: '0.05em', opacity: 0.95 }}
          >
            45° ALTITUDE
          </text>
        </svg>

        {/* Aurora Glow, if visible */}
        {brief?.spaceWeather?.data?.aurora?.visible && (
          <div
            className="absolute bottom-0 left-0 w-[35%] h-[20%] pointer-events-none opacity-40 blur-md"
            style={{ background: 'linear-gradient(to top, var(--color-aurora), transparent)' }}
          />
        )}

        {/* Skeleton loading dashes */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="type-micro text-brass-500 tracking-widest animate-pulse">
              — — HORIZON ACQUIRING — —
            </span>
          </div>
        )}

        {/* Markers */}
        {!loading &&
          markers.map((m) => {
            const coords = azAltToArcPercent(m.azimuthDeg, m.altitudeDeg, sweep);
            if (!coords) return null;
            const isHovered = hoveredMarker?.id === m.id;

            return (
              <div
                key={m.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{
                  left: `${coords.leftPercent.toFixed(2)}%`,
                  top: `${coords.topPercent.toFixed(2)}%`,
                }}
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
                  <div className="absolute bottom-[calc(100%+44px)] left-1/2 -translate-x-1/2 whitespace-nowrap bg-sky-900 border border-brass-500/50 px-2 py-1 rounded text-xs shadow-lg z-20 pointer-events-none">
                    <div className="type-micro font-semibold text-sky-100">{m.label}</div>
                    <div className="type-micro text-brass-400 text-[11px]">{m.sublabel}</div>
                  </div>
                )}

                {/* Object glyph */}
                <div
                  className={`flex items-center justify-center transition-transform duration-150 ${
                    isHovered ? 'scale-125' : 'group-hover:scale-110'
                  } ${m.colorClass}`}
                >
                  <ObjectGlyph type={m.type} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                {/* Inline label below the glyph */}
                <span className="type-micro text-[10px] text-brass-300 opacity-80 block text-center mt-1">
                  {m.label}
                </span>
              </div>
            );
          })}
      </div>

      {/* Compass axis — each mark positioned from its real azimuth within
          the current sweep window, so the marks line up with the markers
          above them and drop out when they fall outside the field of view. */}
      <div className="relative w-full h-5 border-t border-sky-800/40">
        {compassMarks.map((point) => (
          <div
            key={point.label}
            className="absolute top-0 flex flex-col items-center -translate-x-1/2"
            style={{ left: `${point.leftPercent.toFixed(2)}%` }}
          >
            <div className="w-[1px] h-1.5 bg-brass-500/60" />
            <span className="font-jost text-xs text-brass-400 font-medium tracking-wider">
              {point.label}
            </span>
          </div>
        ))}
      </div>

      {/* Time Scrubber — brass instrument control, §9 */}
      {!hideScrubber && (
        <div className="flex items-center gap-4 mt-2 px-1">
          <span className="font-jost text-xs sm:text-sm text-brass-400 font-medium tracking-wider min-w-[75px]">
            TIME SCRUB
          </span>
          <div className="relative w-full flex flex-col gap-1">
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
              className="horizon-scrub-input w-full cursor-pointer h-1.5 bg-sky-800 rounded appearance-none"
            />
            <div className="relative w-full h-1.5 pointer-events-none">
              {[-6, -3, 0, 3, 6].map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 w-[1px] h-1.5 bg-brass-500/50"
                  style={{ left: `${((tick + 6) / 12) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScrubHours(0)}
            className="font-jost text-xs text-brass-400 hover:text-sky-100 transition-colors px-2.5 py-0.5 border border-brass-500/40 rounded cursor-pointer"
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
