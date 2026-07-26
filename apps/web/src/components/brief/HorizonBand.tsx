import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyBrief } from '@/lib/api';
import { interpolatePassPosition } from '@/lib/pass-interpolation';

interface HorizonBandProps {
  brief: DailyBrief | null;
  loading?: boolean;
}

interface MarkerItem {
  id: string;
  label: string;
  sublabel: string;
  type: 'iss' | 'sun' | 'jupiter' | 'neo' | 'aurora';
  azimuthDeg: number;
  altitudeDeg: number;
  colorClass: string;
  available: boolean;
}

// Compass direction ticks (0° to 360°)
const COMPASS_TICKS = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SW', deg: 225 },
  { label: 'W', deg: 270 },
  { label: 'N', deg: 360 },
];

export function HorizonBand({ brief, loading }: HorizonBandProps): React.ReactElement {
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
    const list: MarkerItem[] = [];

    // 1. Sun Position
    const sunAlt = brief?.skyAnchor?.data?.sunAltitudeDeg ?? -90;
    list.push({
      id: 'sun',
      label: 'SUN',
      sublabel: `Alt ${sunAlt.toFixed(1)}°`,
      type: 'sun',
      azimuthDeg: 180, // Azimuth not provided by skyAnchor for Sun, fixed to South for visualization (see DECISIONS.md)
      altitudeDeg: sunAlt,
      colorClass: 'bg-solar',
      available: true,
    });

    // 2. ISS Position — interpolated along the next visible pass's own
    // timeline (start → max → end); no marker outside the pass window. The
    // full rationale lives with the shared implementation in
    // `@/lib/pass-interpolation` — note the scrub time moves along the pass's
    // timeline, not linearly across the scrubber's full ±6h range.
    const pass = brief?.iss?.status === 'ok' ? (brief.iss.data?.nextPass ?? null) : null;
    if (pass) {
      const pos = interpolatePassPosition(pass, effectiveTime.getTime() / 1000);
      if (pos) {
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

    // 3. Jupiter (Representative bright planet marker)
    if (brief?.skyAnchor?.data?.jupiter) {
      const jupiterAlt = brief.skyAnchor.data.jupiter.altitudeDeg;
      if (jupiterAlt > -10) {
        list.push({
          id: 'jupiter',
          label: 'JUPITER',
          sublabel: `Alt ${Math.max(0, jupiterAlt).toFixed(0)}°`,
          type: 'jupiter',
          azimuthDeg: brief.skyAnchor.data.jupiter.azimuthDeg,
          altitudeDeg: Math.max(2, jupiterAlt),
          colorClass: 'bg-brass-300',
          available: true,
        });
      }
    }

    return list;
  }, [effectiveTime, brief]);

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

  // Convert (Azimuth, Altitude) to SVG percent coordinates
  // Horizontal: Azimuth 0° to 360° -> 0% to 100%
  // Vertical: Altitude 0° (horizon) to 90° (zenith) -> 100% (bottom) to 0% (top)
  const getCoords = (az: number, alt: number) => {
    const x = (az / 360) * 100;
    const clampedAlt = Math.max(0, Math.min(90, alt));
    const y = 100 - (clampedAlt / 90) * 100;
    return { x: `${x.toFixed(2)}%`, y: `${y.toFixed(2)}%` };
  };

  return (
    <section aria-label="The Horizon Band" className="w-full my-12 flex flex-col gap-3">
      {/* Visual Band Header / Title */}
      <div className="flex justify-between items-baseline px-1">
        <span className="type-micro text-brass-500 tracking-wider uppercase">
          HORIZON BAND · LOCAL FIELD OF VIEW
        </span>
        <span className="type-micro text-sky-400">
          {scrubHours === 0
            ? 'LIVE (NOW)'
            : `${scrubHours > 0 ? '+' : ''}${scrubHours.toFixed(1)}h FROM NOW`}
        </span>
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

      {/* Compass Ticks Axis (N NE E SE S SW W N) */}
      <div className="relative w-full h-5 flex justify-between px-1 border-t border-sky-800/40">
        {COMPASS_TICKS.map((t, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="w-[1px] h-1.5 bg-brass-500/60" />
            <span className="type-micro text-[10px] text-brass-500 tracking-wider">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Time Scrubber */}
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
