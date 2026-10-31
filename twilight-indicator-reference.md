### 1. Coordinate & Mapping Utility (`twilightMapping.ts`)

```ts
// twilightMapping.ts

export interface Point2D {
  x: number;
  y: number;
}

export interface TwilightBoundary {
  id: 'horizon' | 'civil' | 'nautical' | 'astronomical';
  altitude: 0 | -6 | -12 | -18;
  label: string;
  shortLabel: string;
  phaseRangeLabel: string;
}

export interface TwilightBand {
  id: 'civil-band' | 'nautical-band' | 'astronomical-band';
  label: string;
  upperAltitude: number;
  lowerAltitude: number;
  fill: string;
}

export interface NextBoundaryMetrics {
  nearestBoundary: TwilightBoundary;
  angularDistance: number;
  nextUpperBoundary: TwilightBoundary | null;
  nextLowerBoundary: TwilightBoundary | null;
  bandProgress: number | null;
}

export const MIN_ALTITUDE = -18;
export const MAX_ALTITUDE = 90;
export const HORIZON_ALTITUDE = 0;

/**
 * Sub-horizon angular magnification factor (2.5° visual arc per 1° solar altitude).
 * Maps [-18°, 0°] -> [-45°, 0°] so each 6° twilight zone occupies a legible 15° sector
 * while keeping 0° strictly locked to the horizontal horizon plane and +90° at the Zenith.
 */
export const SUB_HORIZON_SCALE = 2.5;

export const TWILIGHT_BOUNDARIES: readonly TwilightBoundary[] = [
  {
    id: 'horizon',
    altitude: 0,
    label: 'Sunrise / Sunset Horizon',
    shortLabel: '0°',
    phaseRangeLabel: 'Horizon (0.0°)',
  },
  {
    id: 'civil',
    altitude: -6,
    label: 'Civil Twilight Limit',
    shortLabel: '-6°',
    phaseRangeLabel: 'Civil (0° to -6°)',
  },
  {
    id: 'nautical',
    altitude: -12,
    label: 'Nautical Twilight Limit',
    shortLabel: '-12°',
    phaseRangeLabel: 'Nautical (-6° to -12°)',
  },
  {
    id: 'astronomical',
    altitude: -18,
    label: 'Astronomical Twilight Limit',
    shortLabel: '-18°',
    phaseRangeLabel: 'Astronomical (-12° to -18°)',
  },
] as const;

export const TWILIGHT_BANDS: readonly TwilightBand[] = [
  {
    id: 'civil-band',
    label: 'Civil Twilight',
    upperAltitude: 0,
    lowerAltitude: -6,
    fill: 'rgba(212, 155, 56, 0.14)',
  },
  {
    id: 'nautical-band',
    label: 'Nautical Twilight',
    upperAltitude: -6,
    lowerAltitude: -12,
    fill: 'rgba(110, 134, 166, 0.14)',
  },
  {
    id: 'astronomical-band',
    label: 'Astronomical Twilight',
    upperAltitude: -12,
    lowerAltitude: -18,
    fill: 'rgba(64, 78, 98, 0.13)',
  },
] as const;

/**
 * Safely sanitizes and clamps solar altitude to the valid instrument domain [-18°, +90°].
 */
export function clampAltitude(altitude: number): number {
  if (!Number.isFinite(altitude)) {
    return HORIZON_ALTITUDE;
  }
  return Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude));
}

/**
 * Piecewise-linear polar projection mapping solar altitude h in [-18°, +90°]
 * to an instrument polar angle theta (in degrees) relative to the right horizontal horizon:
 *
 * - For h >= 0° (Daylight / Upper Hemisphere):
 *   theta(h) = h  (true 1:1 geometric elevation from 0° Horizon to +90° Zenith)
 * - For h < 0° (Sub-horizon Twilight Sector):
 *   theta(h) = h * 2.5  (maps -6° -> -15°, -12° -> -30°, -18° -> -45°)
 */
export function altitudeToPolarAngle(altitude: number): number {
  const clamped = clampAltitude(altitude);
  return clamped >= 0 ? clamped : clamped * SUB_HORIZON_SCALE;
}

/**
 * Converts a polar elevation angle (where 0° is along the right horizontal horizon +X axis
 * and positive angles rotate counter-clockwise toward the top Zenith -Y axis in SVG space)
 * into SVG Cartesian coordinates.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  polarAngleDeg: number,
): Point2D {
  const radians = (polarAngleDeg * Math.PI) / 180;
  return {
    x: Number((cx + radius * Math.cos(radians)).toFixed(3)),
    y: Number((cy - radius * Math.sin(radians)).toFixed(3)),
  };
}

/**
 * Directly maps a solar altitude (in degrees) to an SVG (x, y) point on a circle of given radius.
 */
export function altitudeToPoint(cx: number, cy: number, radius: number, altitude: number): Point2D {
  const polarAngle = altitudeToPolarAngle(altitude);
  return polarToCartesian(cx, cy, radius, polarAngle);
}

/**
 * Generates an SVG path string for a circular arc between two polar angles (in degrees).
 * Expects startAngleDeg <= endAngleDeg.
 */
export function describePolarArc(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const start = polarToCartesian(cx, cy, radius, startAngleDeg);
  const end = polarToCartesian(cx, cy, radius, endAngleDeg);
  const delta = Math.abs(endAngleDeg - startAngleDeg);
  const largeArcFlag = delta > 180 ? 1 : 0;
  // Counter-clockwise in SVG screen coordinates corresponds to sweep-flag = 0
  const sweepFlag = endAngleDeg >= startAngleDeg ? 0 : 1;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

/**
 * Generates a closed SVG path for an annular sector (twilight zone wedge)
 * bounded by two solar altitudes and inner/outer radii.
 */
export function describeTwilightSector(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  lowerAltitude: number,
  upperAltitude: number,
): string {
  const startAngle = altitudeToPolarAngle(lowerAltitude);
  const endAngle = altitudeToPolarAngle(upperAltitude);

  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/**
 * Calculates proximity metrics between the live solar altitude and the defined
 * astronomical twilight boundaries (0°, -6°, -12°, -18°).
 */
export function getNextBoundaryMetrics(sunAltitude: number): NextBoundaryMetrics {
  const safeAlt = Number.isFinite(sunAltitude) ? sunAltitude : 0;

  let nearestBoundary = TWILIGHT_BOUNDARIES[0];
  let minDistance = Math.abs(safeAlt - nearestBoundary.altitude);

  for (const boundary of TWILIGHT_BOUNDARIES) {
    const dist = Math.abs(safeAlt - boundary.altitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestBoundary = boundary;
    }
  }

  // Determine bounding pair if inside [-18°, 0°]
  let nextUpperBoundary: TwilightBoundary | null = null;
  let nextLowerBoundary: TwilightBoundary | null = null;
  let bandProgress: number | null = null;

  if (safeAlt > 0) {
    nextLowerBoundary = TWILIGHT_BOUNDARIES[0]; // 0° Horizon
  } else if (safeAlt <= -18) {
    nextUpperBoundary = TWILIGHT_BOUNDARIES[3]; // -18° Astronomical limit
  } else {
    for (let i = 0; i < TWILIGHT_BOUNDARIES.length - 1; i++) {
      const upper = TWILIGHT_BOUNDARIES[i];
      const lower = TWILIGHT_BOUNDARIES[i + 1];
      if (safeAlt <= upper.altitude && safeAlt >= lower.altitude) {
        nextUpperBoundary = upper;
        nextLowerBoundary = lower;
        bandProgress = (safeAlt - lower.altitude) / (upper.altitude - lower.altitude);
        break;
      }
    }
  }

  return {
    nearestBoundary,
    angularDistance: Number(minDistance.toFixed(1)),
    nextUpperBoundary,
    nextLowerBoundary,
    bandProgress,
  };
}

/**
 * Formats an altitude value with an explicit algebraic sign (+ / -) and degree symbol.
 */
export function formatSignedAltitude(altitude: number, decimals = 1): string {
  if (!Number.isFinite(altitude)) {
    return '0.0°';
  }
  const fixed = Math.abs(altitude).toFixed(decimals);
  if (altitude > 0) return `+${fixed}°`;
  if (altitude < 0) return `-${fixed}°`;
  return `0.0°`;
}
```

---

### 2. Twilight Indicator Component (`TwilightIndicator.tsx`)

```tsx
// TwilightIndicator.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  MAX_ALTITUDE,
  MIN_ALTITUDE,
  TWILIGHT_BANDS,
  TWILIGHT_BOUNDARIES,
  TwilightBoundary,
  altitudeToPoint,
  altitudeToPolarAngle,
  clampAltitude,
  describePolarArc,
  describeTwilightSector,
  formatSignedAltitude,
  getNextBoundaryMetrics,
  polarToCartesian,
} from './twilightMapping';
import './TwilightIndicator.css';

export interface TwilightIndicatorProps {
  /** Current solar altitude in degrees relative to the local horizon. */
  sunAltitude: number;
  /** Current active twilight or daylight phase label supplied by ASTRA-NET. */
  twilightPhase: string;
  /** Optional additional class name for layout positioning. */
  className?: string;
}

interface TooltipData {
  id: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
}

// SVG Coordinate System Constants (viewBox: 0 0 264 134)
const SVG_WIDTH = 264;
const SVG_HEIGHT = 134;
const ORIGIN_X = 96;
const ORIGIN_Y = 78;
const ARC_RADIUS = 64;
const BAND_INNER_RADIUS = 53;
const HORIZON_LEFT_X = 16;
const HORIZON_RIGHT_X = 186;

/**
 * Hook that smoothly interpolates solar altitude along the meridian arc
 * using cubic ease-out while respecting `prefers-reduced-motion: reduce`.
 */
function useAnimatedAltitude(targetAltitude: number, durationMs = 280): number {
  const clampedTarget = clampAltitude(targetAltitude);
  const [animatedValue, setAnimatedValue] = useState<number>(clampedTarget);
  const currentRef = useRef<number>(clampedTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || Math.abs(clampedTarget - currentRef.current) < 0.01) {
      currentRef.current = clampedTarget;
      setAnimatedValue(clampedTarget);
      return;
    }

    const startValue = currentRef.current;
    const delta = clampedTarget - startValue;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out for crisp, instrument-grade settling
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = startValue + delta * eased;

      currentRef.current = nextVal;
      setAnimatedValue(nextVal);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = clampedTarget;
        setAnimatedValue(clampedTarget);
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [clampedTarget, durationMs]);

  return animatedValue;
}

export const TwilightIndicator: React.FC<TwilightIndicatorProps> = React.memo(
  ({ sunAltitude, twilightPhase, className = '' }) => {
    const uniqueId = useId();
    const titleId = `astra-twilight-title-${uniqueId}`;
    const descId = `astra-twilight-desc-${uniqueId}`;

    const [activeTooltip, setActiveTooltip] = useState<TooltipData | null>(null);

    const safeAltitude = Number.isFinite(sunAltitude) ? sunAltitude : 0;
    const animatedAltitude = useAnimatedAltitude(safeAltitude);

    const isAboveHorizon = safeAltitude >= 0;
    const isClampedLow = safeAltitude < MIN_ALTITUDE;
    const isClampedHigh = safeAltitude > MAX_ALTITUDE;

    const boundaryMetrics = useMemo(() => getNextBoundaryMetrics(safeAltitude), [safeAltitude]);

    // Precompute static SVG paths for the semicircular dome and twilight sectors
    const staticGeometry = useMemo(() => {
      // Full 180° semicircular upper sky dome (0° East/Right Horizon -> 90° Zenith -> 180° West/Left Horizon)
      const upperDomeArc = describePolarArc(ORIGIN_X, ORIGIN_Y, ARC_RADIUS, 0, 180);
      // Active right-hand solar elevation limb (0° Horizon -> +90° Zenith)
      const activeDayArc = describePolarArc(ORIGIN_X, ORIGIN_Y, ARC_RADIUS, 0, 90);
      // Sub-horizon twilight outer limb (-45° [-18° alt] -> 0° [0° alt])
      const subHorizonArc = describePolarArc(ORIGIN_X, ORIGIN_Y, ARC_RADIUS, -45, 0);
      // Sub-horizon inner ring guide
      const subHorizonInnerArc = describePolarArc(ORIGIN_X, ORIGIN_Y, BAND_INNER_RADIUS, -45, 0);

      const bandPaths = TWILIGHT_BANDS.map((band) => ({
        ...band,
        d: describeTwilightSector(
          ORIGIN_X,
          ORIGIN_Y,
          BAND_INNER_RADIUS,
          ARC_RADIUS,
          band.lowerAltitude,
          band.upperAltitude,
        ),
      }));

      const boundaryMarkers = TWILIGHT_BOUNDARIES.map((b) => {
        const angle = altitudeToPolarAngle(b.altitude);
        const innerPt = polarToCartesian(
          ORIGIN_X,
          ORIGIN_Y,
          b.altitude === 0 ? BAND_INNER_RADIUS - 3 : BAND_INNER_RADIUS,
          angle,
        );
        const outerPt = polarToCartesian(ORIGIN_X, ORIGIN_Y, ARC_RADIUS + 4, angle);
        const labelPt = polarToCartesian(ORIGIN_X, ORIGIN_Y, ARC_RADIUS + 16, angle);
        const hitPt = polarToCartesian(
          ORIGIN_X,
          ORIGIN_Y,
          (BAND_INNER_RADIUS + ARC_RADIUS) / 2,
          angle,
        );

        return {
          ...b,
          angle,
          innerPt,
          outerPt,
          labelPt,
          hitPt,
        };
      });

      const zenithTickInner = polarToCartesian(ORIGIN_X, ORIGIN_Y, ARC_RADIUS - 3, 90);
      const zenithTickOuter = polarToCartesian(ORIGIN_X, ORIGIN_Y, ARC_RADIUS + 3, 90);

      return {
        upperDomeArc,
        activeDayArc,
        subHorizonArc,
        subHorizonInnerArc,
        bandPaths,
        boundaryMarkers,
        zenithTickInner,
        zenithTickOuter,
      };
    }, []);

    // Live animated coordinates for the Sun marker & almucantar guide
    const sunPosition = useMemo(
      () => altitudeToPoint(ORIGIN_X, ORIGIN_Y, ARC_RADIUS, animatedAltitude),
      [animatedAltitude],
    );

    const activeBandId = useMemo(() => {
      if (safeAltitude < 0 && safeAltitude >= -6) return 'civil-band';
      if (safeAltitude < -6 && safeAltitude >= -12) return 'nautical-band';
      if (safeAltitude < -12 && safeAltitude >= -18) return 'astronomical-band';
      return null;
    }, [safeAltitude]);

    const handleBoundaryInteraction = (
      boundary: TwilightBoundary & { outerPt: { x: number; y: number } },
    ) => {
      setActiveTooltip({
        id: `boundary-${boundary.id}`,
        title: boundary.label,
        subtitle: `Boundary: ${boundary.shortLabel} (${boundary.phaseRangeLabel})`,
        x: boundary.outerPt.x,
        y: boundary.outerPt.y,
        align: 'right',
      });
    };

    const handleSunInteraction = () => {
      setActiveTooltip({
        id: 'sun-marker',
        title: twilightPhase,
        subtitle: `Sun Alt: ${formatSignedAltitude(safeAltitude, 1)}${
          isClampedLow ? ' (Below -18° scale)' : isClampedHigh ? ' (Clamped +90°)' : ''
        }`,
        x: sunPosition.x,
        y: sunPosition.y,
        align: sunPosition.x > 135 ? 'right' : 'center',
      });
    };

    const clearTooltip = () => setActiveTooltip(null);

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      } else if (e.key === 'Escape') {
        clearTooltip();
      }
    };

    return (
      <div className={`astra-twilight ${className}`.trim()} onMouseLeave={clearTooltip}>
        <div className="astra-twilight__instrument">
          <svg
            className="astra-twilight__svg"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>Solar Altitude and Twilight Horizon Indicator</title>
            <desc id={descId}>
              {`Sun altitude is ${formatSignedAltitude(safeAltitude, 1)}, currently ${
                isAboveHorizon ? 'above' : 'below'
              } the horizon in ${twilightPhase}. Nearest boundary is ${
                boundaryMetrics.nearestBoundary.shortLabel
              } at ${boundaryMetrics.angularDistance} degrees distance.`}
            </desc>

            {/* Sub-horizon Ground Reference Plane */}
            <line
              x1={ORIGIN_X}
              y1={ORIGIN_Y}
              x2={ORIGIN_X}
              y2={ORIGIN_Y + 48}
              className="astra-twilight__nadir-axis"
            />

            {/* Twilight Annular Bands (0° to -6°, -6° to -12°, -12° to -18°) */}
            <g className="astra-twilight__bands">
              {staticGeometry.bandPaths.map((band) => {
                const isCurrentBand = band.id === activeBandId;
                return (
                  <path
                    key={band.id}
                    d={band.d}
                    fill={band.fill}
                    className={`astra-twilight__band ${
                      isCurrentBand ? 'astra-twilight__band--active' : ''
                    }`}
                  />
                );
              })}
            </g>

            {/* Semicircular Sky Dome (Left reference hemisphere + Right active meridian) */}
            <path d={staticGeometry.upperDomeArc} className="astra-twilight__dome-reference" />
            <path d={staticGeometry.activeDayArc} className="astra-twilight__dome-active" />

            {/* Sub-horizon Twilight Arcs */}
            <path d={staticGeometry.subHorizonArc} className="astra-twilight__subhorizon-arc" />
            <path
              d={staticGeometry.subHorizonInnerArc}
              className="astra-twilight__subhorizon-inner-arc"
            />

            {/* Zenith (+90°) Reference Tick & Label */}
            <line
              x1={staticGeometry.zenithTickInner.x}
              y1={staticGeometry.zenithTickInner.y}
              x2={staticGeometry.zenithTickOuter.x}
              y2={staticGeometry.zenithTickOuter.y}
              className="astra-twilight__zenith-tick"
            />
            <text
              x={ORIGIN_X}
              y={ORIGIN_Y - ARC_RADIUS - 6}
              textAnchor="middle"
              className="astra-twilight__scale-label astra-twilight__scale-label--zenith"
            >
              +90°
            </text>

            {/* Horizontal 0° Horizon Line */}
            <line
              x1={HORIZON_LEFT_X}
              y1={ORIGIN_Y}
              x2={HORIZON_RIGHT_X}
              y2={ORIGIN_Y}
              className="astra-twilight__horizon-line"
            />
            <text
              x={HORIZON_LEFT_X}
              y={ORIGIN_Y - 5}
              textAnchor="start"
              className="astra-twilight__horizon-tag"
            >
              HORIZON
            </text>

            {/* Observer Origin Reticle */}
            <circle cx={ORIGIN_X} cy={ORIGIN_Y} r={2} className="astra-twilight__origin-dot" />

            {/* Active Solar Almucantar (Horizontal Projection) & Radial Vector */}
            <line
              x1={ORIGIN_X}
              y1={sunPosition.y}
              x2={sunPosition.x}
              y2={sunPosition.y}
              className="astra-twilight__almucantar-line"
            />
            <line
              x1={ORIGIN_X}
              y1={ORIGIN_Y}
              x2={sunPosition.x}
              y2={sunPosition.y}
              className="astra-twilight__radial-vector"
            />

            {/* Twilight Boundary Markers & Interactive Targets (0°, -6°, -12°, -18°) */}
            <g className="astra-twilight__boundaries">
              {staticGeometry.boundaryMarkers.map((marker) => {
                const isNearest = boundaryMetrics.nearestBoundary.id === marker.id;
                const isSelected = activeTooltip?.id === `boundary-${marker.id}`;

                return (
                  <g
                    key={marker.id}
                    className={`astra-twilight__boundary-group ${
                      isNearest ? 'astra-twilight__boundary-group--nearest' : ''
                    } ${isSelected ? 'astra-twilight__boundary-group--selected' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${marker.label}: ${marker.shortLabel}`}
                    onMouseEnter={() => handleBoundaryInteraction(marker)}
                    onFocus={() => handleBoundaryInteraction(marker)}
                    onBlur={clearTooltip}
                    onKeyDown={(e) => handleKeyDown(e, () => handleBoundaryInteraction(marker))}
                  >
                    {/* Visible crisp radial tick */}
                    <line
                      x1={marker.innerPt.x}
                      y1={marker.innerPt.y}
                      x2={marker.outerPt.x}
                      y2={marker.outerPt.y}
                      className="astra-twilight__boundary-tick"
                    />
                    {/* Scale label */}
                    <text
                      x={marker.labelPt.x + 2}
                      y={marker.labelPt.y + 3}
                      textAnchor="start"
                      className="astra-twilight__scale-label"
                    >
                      {marker.shortLabel}
                    </text>
                    {/* Transparent accessible hit target */}
                    <circle
                      cx={marker.outerPt.x}
                      cy={marker.outerPt.y}
                      r={8}
                      fill="transparent"
                      className="astra-twilight__hit-target"
                    />
                  </g>
                );
              })}
            </g>

            {/* Interactive Sun Marker */}
            <g
              className={`astra-twilight__sun-group ${
                isAboveHorizon
                  ? 'astra-twilight__sun-group--day'
                  : 'astra-twilight__sun-group--subhorizon'
              }`}
              transform={`translate(${sunPosition.x}, ${sunPosition.y})`}
              tabIndex={0}
              role="button"
              aria-label={`Sun marker at ${formatSignedAltitude(
                safeAltitude,
                1,
              )}, ${twilightPhase}`}
              onMouseEnter={handleSunInteraction}
              onFocus={handleSunInteraction}
              onBlur={clearTooltip}
              onKeyDown={(e) => handleKeyDown(e, handleSunInteraction)}
            >
              {/* Subtle outer instrument reticle ring */}
              <circle cx={0} cy={0} r={6.5} className="astra-twilight__sun-ring" />
              {/* Core amber solar disc */}
              <circle cx={0} cy={0} r={3.2} className="astra-twilight__sun-core" />
              {/* Clamped range indicator chevron if below -18° */}
              {isClampedLow && (
                <path
                  d="M -2.5 9 L 0 12 L 2.5 9"
                  fill="none"
                  className="astra-twilight__clamp-indicator"
                />
              )}
              {/* Invisible hit target for hover/focus ergonomics */}
              <circle cx={0} cy={0} r={11} fill="transparent" />
            </g>
          </svg>

          {/* Compact Scientific Tooltip Overlay */}
          {activeTooltip && (
            <div
              className={`astra-twilight__tooltip astra-twilight__tooltip--${activeTooltip.align}`}
              role="status"
              aria-live="polite"
            >
              <span className="astra-twilight__tooltip-title">{activeTooltip.title}</span>
              <span className="astra-twilight__tooltip-subtitle">{activeTooltip.subtitle}</span>
            </div>
          )}
        </div>

        {/* Right-hand Telemetry & Phase Readout */}
        <div className="astra-twilight__telemetry">
          <div className="astra-twilight__altitude-row">
            <span
              className="astra-twilight__live-dot"
              aria-hidden="true"
              title="Live Ephemeris Feed"
            />
            <span className="astra-twilight__altitude-value">
              {formatSignedAltitude(safeAltitude, 1)}
            </span>
            <span className="astra-twilight__horizon-state">
              {isAboveHorizon ? 'ABOVE HORIZON' : 'BELOW HORIZON'}
            </span>
          </div>

          <div className="astra-twilight__phase-label" title={twilightPhase}>
            {twilightPhase}
          </div>

          <div className="astra-twilight__boundary-delta">
            <span className="astra-twilight__delta-key">NEAREST LIMIT</span>
            <span className="astra-twilight__delta-val">
              {boundaryMetrics.nearestBoundary.shortLabel}{' '}
              <span className="astra-twilight__delta-sep">
                (Δ {boundaryMetrics.angularDistance.toFixed(1)}°)
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  },
);

TwilightIndicator.displayName = 'TwilightIndicator';

export default TwilightIndicator;
```

---

### 3. Scoped Stylesheet (`TwilightIndicator.css`)

```css
/* TwilightIndicator.css */

.astra-twilight {
  --astra-bg-transparent: transparent;
  --astra-surface-subtle: #0d1015;
  --astra-border-hairline: #1e2430;
  --astra-text-primary: #e2e6ee;
  --astra-text-secondary: #7c8799;
  --astra-text-muted: #4f5969;
  --astra-accent-amber: #d49b38;
  --astra-accent-amber-dim: rgba(212, 155, 56, 0.32);
  --astra-accent-green: #489e72;
  --astra-horizon-stroke: #566378;
  --astra-font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  --astra-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  display: inline-flex;
  align-items: center;
  gap: 14px;
  background: var(--astra-bg-transparent);
  color: var(--astra-text-primary);
  font-family: var(--astra-font-sans);
  user-select: none;
  max-width: 100%;
  box-sizing: border-box;
}

.astra-twilight__instrument {
  position: relative;
  width: 210px;
  min-width: 165px;
  flex-shrink: 0;
}

.astra-twilight__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Semicircular Sky Dome & Meridian Arcs */
.astra-twilight__dome-reference {
  fill: none;
  stroke: #1b2029;
  stroke-width: 1;
  stroke-dasharray: 2 2.5;
}

.astra-twilight__dome-active {
  fill: none;
  stroke: #323b4a;
  stroke-width: 1.15;
}

.astra-twilight__subhorizon-arc {
  fill: none;
  stroke: #3b4659;
  stroke-width: 1.15;
}

.astra-twilight__subhorizon-inner-arc {
  fill: none;
  stroke: #1d232e;
  stroke-width: 0.75;
}

.astra-twilight__nadir-axis {
  stroke: #161b24;
  stroke-width: 0.75;
  stroke-dasharray: 1.5 2.5;
}

/* Twilight Annular Zones */
.astra-twilight__band {
  stroke: rgba(124, 135, 153, 0.12);
  stroke-width: 0.5;
  transition: opacity 180ms ease;
}

.astra-twilight__band--active {
  stroke: rgba(212, 155, 56, 0.42);
  stroke-width: 0.85;
}

/* Horizon 0° Plane & Observer Origin */
.astra-twilight__horizon-line {
  stroke: var(--astra-horizon-stroke);
  stroke-width: 1.1;
}

.astra-twilight__horizon-tag {
  fill: var(--astra-text-muted);
  font-family: var(--astra-font-mono);
  font-size: 7.5px;
  letter-spacing: 0.08em;
}

.astra-twilight__origin-dot {
  fill: var(--astra-horizon-stroke);
}

.astra-twilight__zenith-tick {
  stroke: #323b4a;
  stroke-width: 1;
}

/* Dynamic Solar Almucantar & Vector */
.astra-twilight__almucantar-line {
  stroke: rgba(212, 155, 56, 0.24);
  stroke-width: 0.75;
  stroke-dasharray: 2 2;
}

.astra-twilight__radial-vector {
  stroke: rgba(212, 155, 56, 0.35);
  stroke-width: 0.85;
}

/* Boundary Ticks & Labels (0°, -6°, -12°, -18°) */
.astra-twilight__boundary-group {
  cursor: pointer;
  outline: none;
}

.astra-twilight__boundary-tick {
  stroke: #525f73;
  stroke-width: 1;
  transition:
    stroke 150ms ease,
    stroke-width 150ms ease;
}

.astra-twilight__boundary-group--nearest .astra-twilight__boundary-tick {
  stroke: #8c9bb0;
}

.astra-twilight__boundary-group:hover .astra-twilight__boundary-tick,
.astra-twilight__boundary-group:focus-visible .astra-twilight__boundary-tick,
.astra-twilight__boundary-group--selected .astra-twilight__boundary-tick {
  stroke: var(--astra-accent-amber);
  stroke-width: 1.5;
}

.astra-twilight__scale-label {
  fill: var(--astra-text-secondary);
  font-family: var(--astra-font-mono);
  font-size: 8.5px;
  letter-spacing: 0.02em;
  transition: fill 150ms ease;
}

.astra-twilight__scale-label--zenith {
  fill: var(--astra-text-muted);
  font-size: 7.5px;
}

.astra-twilight__boundary-group:hover .astra-twilight__scale-label,
.astra-twilight__boundary-group:focus-visible .astra-twilight__scale-label,
.astra-twilight__boundary-group--selected .astra-twilight__scale-label {
  fill: var(--astra-text-primary);
}

/* Sun Marker */
.astra-twilight__sun-group {
  cursor: pointer;
  outline: none;
}

.astra-twilight__sun-ring {
  fill: rgba(13, 16, 21, 0.75);
  stroke: var(--astra-accent-amber-dim);
  stroke-width: 1;
  transition:
    stroke 150ms ease,
    r 150ms ease;
}

.astra-twilight__sun-core {
  fill: var(--astra-accent-amber);
}

.astra-twilight__sun-group--subhorizon .astra-twilight__sun-core {
  fill: #c68d2e;
}

.astra-twilight__sun-group:hover .astra-twilight__sun-ring,
.astra-twilight__sun-group:focus-visible .astra-twilight__sun-ring {
  stroke: var(--astra-accent-amber);
  stroke-width: 1.35;
}

.astra-twilight__clamp-indicator {
  stroke: var(--astra-accent-amber);
  stroke-width: 1;
}

/* Floating Micro-Tooltip */
.astra-twilight__tooltip {
  position: absolute;
  bottom: 4px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 7px;
  background: rgba(10, 12, 16, 0.94);
  border: 1px solid var(--astra-border-hairline);
  border-left: 2px solid var(--astra-accent-amber);
  pointer-events: none;
  z-index: 10;
  max-width: 195px;
}

.astra-twilight__tooltip-title {
  color: var(--astra-text-primary);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.astra-twilight__tooltip-subtitle {
  color: var(--astra-text-secondary);
  font-family: var(--astra-font-mono);
  font-size: 9.5px;
  line-height: 1.25;
  white-space: nowrap;
}

/* Telemetry Readout Column */
.astra-twilight__telemetry {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 138px;
}

.astra-twilight__altitude-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.astra-twilight__live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--astra-accent-green);
  align-self: center;
  flex-shrink: 0;
}

.astra-twilight__altitude-value {
  font-family: var(--astra-font-mono);
  font-size: 15px;
  font-weight: 500;
  color: var(--astra-accent-amber);
  letter-spacing: -0.01em;
}

.astra-twilight__horizon-state {
  font-family: var(--astra-font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  color: var(--astra-text-muted);
}

.astra-twilight__phase-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--astra-text-primary);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.astra-twilight__boundary-delta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
  font-family: var(--astra-font-mono);
  font-size: 9.5px;
}

.astra-twilight__delta-key {
  color: var(--astra-text-muted);
  letter-spacing: 0.05em;
}

.astra-twilight__delta-val {
  color: var(--astra-text-secondary);
}

.astra-twilight__delta-sep {
  color: var(--astra-text-muted);
}

/* Responsive Behaviour */
@media (max-width: 480px) {
  .astra-twilight {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
  }

  .astra-twilight__instrument {
    width: 100%;
    max-width: 230px;
  }

  .astra-twilight__telemetry {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .astra-twilight__band,
  .astra-twilight__boundary-tick,
  .astra-twilight__scale-label,
  .astra-twilight__sun-ring {
    transition: none !important;
  }
}
```

---

### 4. Explanation of the Altitude-to-Position Mapping

The visualization models a **Meridian Altitude Sector & Semicircular Sky Dome** centered on the observer at $(c_x, c_y) = (96, 78)$ with arc radius $R = 64\text{ px}$:

1. **Clamping & Input Sanitization (`clampAltitude`)**:
   Any incoming `sunAltitude` $h$ is checked for `Number.isFinite(h)` and clamped to the supported instrument domain $[-18^\circ, +90^\circ]$. Values below $-18^\circ$ (deep night) rest cleanly at the $-18^\circ$ limit with a subtle downward chevron indicator so SVG coordinates never overflow or invert.
2. **Piecewise-Linear Polar Projection (`altitudeToPolarAngle`)**:

- **Horizon Alignment ($h = 0^\circ$)**: Maps strictly to polar angle $\theta = 0^\circ$, placing the $0^\circ$ marker directly on the horizontal horizon line $y = c_y$ at $(c_x + R, c_y)$.
- **Upper Celestial Hemisphere ($0^\circ \le h \le +90^\circ$)**: Maps at a $1:1$ geometric scale ($\theta(h) = h$), so $+90^\circ$ sits at the exact Zenith apex $(c_x, c_y - R)$ directly above the observer. The left quadrant ($\theta \in [90^\circ, 180^\circ]$) completes the semicircular sky dome silhouette down to the opposite horizon.
- **Sub-Horizon Twilight Sector ($-18^\circ \le h < 0^\circ$)**: Because an unscaled $6^\circ$ band on a compact $64\text{ px}$ radius arc would subtend only $6.7\text{ px}$ of arc length, sub-horizon depression angles use a uniform $2.5\times$ angular magnification ($\theta(h) = 2.5h$):

$$\theta(0^\circ) = 0^\circ, \quad \theta(-6^\circ) = -15^\circ, \quad \theta(-12^\circ) = -30^\circ, \quad \theta(-18^\circ) = -45^\circ$$

Each $6^\circ$ twilight zone therefore spans a uniform $15^\circ$ annular wedge below the horizontal horizon line while remaining strictly linear with respect to solar depression angle.

3. **Polar-to-SVG Cartesian Conversion (`polarToCartesian`)**:

$$(x, y) = \left(c_x + R \cos\left(\frac{\theta \pi}{180}\right),\; c_y - R \sin\left(\frac{\theta \pi}{180}\right)\right)$$

In addition to positioning the Sun marker along the arc, a horizontal almucantar projection line connects $(c_x, y_{\text{sun}})$ to $(x_{\text{sun}}, y_{\text{sun}})$ and a radial vector connects $(c_x, c_y)$ to $(x_{\text{sun}}, y_{\text{sun}})$.

---

### 5. Example Integration with Sky Anchor (`SkyAnchorSection.tsx`)

```tsx
// SkyAnchorSection.tsx
import React from 'react';
import { TwilightIndicator } from './TwilightIndicator';

export interface SkyAnchorTelemetry {
  sunAltitude: number;
  twilightPhase: string;
  localSiderealTime: string;
  observerLatitude: number;
  observerLongitude: number;
}

interface SkyAnchorSectionProps {
  telemetry: SkyAnchorTelemetry;
}

export const SkyAnchorSection: React.FC<SkyAnchorSectionProps> = ({ telemetry }) => {
  return (
    <section
      aria-label="Sky Anchor Solar Reference"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '8px 0',
        backgroundColor: '#000000',
        borderBottom: '1px solid #161b24',
      }}
    >
      {/* Live Twilight Indicator receiving props from ASTRA-NET data layer */}
      <TwilightIndicator
        sunAltitude={telemetry.sunAltitude}
        twilightPhase={telemetry.twilightPhase}
      />

      {/* Example usage with your reference values:
          <TwilightIndicator
            sunAltitude={-14.3}
            twilightPhase="Astronomical Twilight"
          />
      */}
    </section>
  );
};
```

---

### 6. Interactions, Accessibility & Responsive Behaviour

- **Hover & Keyboard Focus Inspection**: Every boundary marker ($0^\circ, -6^\circ, -12^\circ, -18^\circ$) and the Sun marker is focusable (`tabIndex={0}`, `role="button"`, `aria-label`) and responds to both mouse hover and keyboard navigation (`Tab`, `Enter`/`Space`, `Escape`). Activating or hovering over a marker displays a compact, non-clipping instrument readout anchored inside the SVG footprint.
- **Restrained Arc Interpolation**: When `sunAltitude` updates, `useAnimatedAltitude` interpolates the scalar altitude over `280ms` with a cubic ease-out curve before projecting to $(x, y)$, ensuring the Sun marker travels strictly along the circular limb rather than cutting across a linear chord. If `prefers-reduced-motion: reduce` is enabled, updates snap immediately without animation frames.
- **Responsive Layout**: The SVG uses a fixed internal coordinate system (`viewBox="0 0 264 134"`) that scales fluidly. Above `480px`, the semicircular gauge and telemetry readout sit side-by-side; below `480px`, they stack cleanly without clipping labels or tooltips.

---

### 7. Dependencies Required

- **`react` / `react-dom` (`>=18.0.0`)**: Uses standard React hooks (`useMemo`, `useState`, `useEffect`, `useRef`, `useId`).
- **Zero third-party libraries**: All polar geometry, SVG arc/sector generation, and cubic ease-out `requestAnimationFrame` interpolation are implemented natively in TypeScript to avoid bundle overhead or external animation dependencies.
