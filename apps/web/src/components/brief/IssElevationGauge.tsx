import React from 'react';

interface IssElevationGaugeProps {
  maxElevationDeg: number;
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

export function IssElevationGauge({ maxElevationDeg }: IssElevationGaugeProps): React.ReactElement {
  const elev = Math.max(0, Math.min(90, maxElevationDeg));

  const cx = 50;
  const cy = 48;
  const r = 36;

  // Semicircle from left (0° horizon, angle 180°) to top (90° zenith, angle 90°)
  // Angle = 180 - (elev / 90) * 90 = 180 - elev
  const needleAngle = 180 - elev;
  const needlePos = polarToCartesian(cx, cy, r, needleAngle);

  // Quality of pass rating based on peak altitude
  const quality =
    elev >= 60 ? 'HIGH OVERHEAD PASS' : elev >= 30 ? 'CLEAR VIEW PASS' : 'LOW HORIZON PASS';

  return (
    <div className="flex flex-col gap-1">
      <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
        PEAK ALTITUDE
      </span>
      <div className="flex items-center gap-3">
        <div className="relative w-[96px] h-[56px]">
          <svg viewBox="0 0 100 58" className="w-full h-full overflow-visible">
            {/* Background 0° to 90° arc */}
            <path
              d={describeArc(cx, cy, r, 180, 90)}
              fill="none"
              stroke="#1c2424"
              strokeWidth="6"
            />

            {/* Active filled arc from 0° up to elev */}
            <path
              d={describeArc(cx, cy, r, 180, needleAngle)}
              fill="none"
              stroke="var(--color-brass-400)"
              strokeWidth="5"
            />

            {/* Horizon and Zenith ticks */}
            <line
              x1={cx - r - 4}
              y1={cy}
              x2={cx - r + 3}
              y2={cy}
              stroke="var(--color-sky-400)"
              strokeWidth="1.5"
            />
            <line
              x1={cx}
              y1={cy - r - 4}
              x2={cx}
              y2={cy - r + 3}
              stroke="var(--color-sky-400)"
              strokeWidth="1.5"
            />

            {/* Marker Dot */}
            <circle
              cx={needlePos.x}
              cy={needlePos.y}
              r="3.5"
              fill="var(--color-brass-300)"
              stroke="#000000"
              strokeWidth="1.5"
            />

            {/* Axis labels */}
            <text x="8" y="56" className="font-sans fill-sky-400" style={{ fontSize: '9px' }}>
              0°
            </text>
            <text
              x={cx}
              y="6"
              textAnchor="middle"
              className="font-sans fill-brass-400"
              style={{ fontSize: '9px' }}
            >
              90°
            </text>
          </svg>
        </div>

        <div className="flex flex-col">
          <span className="font-sans text-3xl sm:text-4xl text-sky-100 font-semibold tracking-tight">
            {elev.toFixed(0)}°
          </span>
          <span className="font-sans text-[10px] text-brass-400/90 font-medium whitespace-nowrap uppercase tracking-wide">
            {quality}
          </span>
        </div>
      </div>
    </div>
  );
}
