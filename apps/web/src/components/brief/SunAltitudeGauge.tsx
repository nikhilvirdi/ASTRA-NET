import React from 'react';

interface SunAltitudeGaugeProps {
  altitudeDeg: number | null | undefined;
  loading?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function SunAltitudeGauge({
  altitudeDeg,
  loading,
}: SunAltitudeGaugeProps): React.ReactElement {
  const isUnavailable = loading || altitudeDeg === null || altitudeDeg === undefined;
  const clampedAlt = altitudeDeg != null ? Math.max(-90, Math.min(90, altitudeDeg)) : null;

  const cx = 60;
  const cy = 52;
  const r = 40;

  // Gauge angles: 180° is left (-90° nadir), 90° is top (0° horizon), 0° is right (+90° zenith)
  // Mapping alt [-90..+90] to angle: angle = 90 - alt
  const needleAngle = clampedAlt !== null ? 90 - clampedAlt : null;
  const needlePos = needleAngle !== null ? polarToCartesian(cx, cy, r, needleAngle) : null;

  // Twilight zones:
  // Night: -90 to -18 (angles 180 to 108)
  const nightArc = describeArc(cx, cy, r, 180, 108);
  // Astronomical twilight: -18 to -12 (angles 108 to 102)
  const astroArc = describeArc(cx, cy, r, 108, 102);
  // Nautical twilight: -12 to -6 (angles 102 to 96)
  const nautArc = describeArc(cx, cy, r, 102, 96);
  // Civil twilight: -6 to 0 (angles 96 to 90)
  const civilArc = describeArc(cx, cy, r, 96, 90);
  // Day: 0 to +90 (angles 90 to 0)
  const dayArc = describeArc(cx, cy, r, 90, 0);

  return (
    <div className="flex flex-col gap-1">
      <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
        SUN ALTITUDE
      </span>
      <div className="flex items-center gap-4">
        <div className="relative w-[120px] h-[72px]">
          <svg viewBox="0 0 120 72" className="w-full h-full overflow-visible">
            {/* Background track */}
            <path
              d={describeArc(cx, cy, r, 180, 0)}
              fill="none"
              stroke="var(--color-sky-950)"
              strokeWidth="7"
            />

            {/* Zone bands */}
            <path d={nightArc} fill="none" stroke="var(--color-sky-900)" strokeWidth="5" />
            <path d={astroArc} fill="none" stroke="var(--color-sky-800)" strokeWidth="5" />
            <path d={nautArc} fill="none" stroke="var(--color-sky-600)" strokeWidth="5" />
            <path d={civilArc} fill="none" stroke="var(--color-sky-400)" strokeWidth="5" />
            <path d={dayArc} fill="none" stroke="var(--color-brass-300)" strokeWidth="5" />

            {/* 0° Horizon Tick Mark */}
            <line
              x1={cx}
              y1={cy - r - 5}
              x2={cx}
              y2={cy - r + 3}
              stroke="var(--color-sky-100)"
              strokeWidth="1.5"
            />

            {/* Needle / Marker */}
            {!isUnavailable && needlePos && (
              <>
                <line
                  x1={cx}
                  y1={cy}
                  x2={needlePos.x}
                  y2={needlePos.y}
                  stroke="var(--color-brass-300)"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity={0.7}
                />
                <circle
                  cx={needlePos.x}
                  cy={needlePos.y}
                  r="4"
                  fill="var(--color-brass-300)"
                  stroke="var(--color-sky-950)"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* Base Labels */}
            <text x="12" y="66" className="font-sans fill-sky-400" style={{ fontSize: '9px' }}>
              -90°
            </text>
            <text
              x={cx}
              y={cy - r - 8}
              textAnchor="middle"
              className="font-sans fill-sky-200"
              style={{ fontSize: '8px', letterSpacing: '0.04em' }}
            >
              0° HORIZON
            </text>
            <text
              x="108"
              y="66"
              textAnchor="end"
              className="font-sans fill-brass-400"
              style={{ fontSize: '9px' }}
            >
              +90°
            </text>
          </svg>
        </div>

        <div className="flex flex-col">
          <span className="font-sans text-3xl sm:text-4xl text-sky-100 font-semibold tracking-tight">
            {isUnavailable || altitudeDeg == null ? '—' : `${altitudeDeg.toFixed(1)}°`}
          </span>
          <span className="font-sans text-xs text-brass-400/90 font-medium uppercase tracking-wide">
            {isUnavailable || altitudeDeg == null
              ? '—'
              : altitudeDeg >= 0
                ? 'ABOVE HORIZON'
                : altitudeDeg >= -6
                  ? 'CIVIL TWILIGHT'
                  : altitudeDeg >= -12
                    ? 'NAUTICAL TWILIGHT'
                    : altitudeDeg >= -18
                      ? 'ASTRO TWILIGHT'
                      : 'ASTRONOMICAL NIGHT'}
          </span>
        </div>
      </div>
    </div>
  );
}
