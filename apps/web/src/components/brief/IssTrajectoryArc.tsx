import React from 'react';
import type { IssNextPassField } from '@/lib/api';

interface IssTrajectoryArcProps {
  pass: IssNextPassField;
}

export function IssTrajectoryArc({ pass }: IssTrajectoryArcProps): React.ReactElement {
  const elev = Math.max(10, Math.min(90, pass.maxElevationDeg));
  // Map elevation to peak height: 90° peaks at y=10, 10° peaks at y=30
  const peakY = 38 - (elev / 90) * 26;

  const startLabel = pass.startAzimuthCompass || '—';
  const maxLabel = pass.maxAzimuthCompass ? `${pass.maxAzimuthCompass} ${elev}°` : `${elev}°`;
  const endLabel = pass.endAzimuthCompass || '—';

  return (
    <div className="flex flex-col gap-1 w-full">
      <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
        PASS TRAJECTORY
      </span>
      <div className="w-full h-[56px] border border-sky-800/60 rounded-sm flex flex-col justify-between p-1.5 relative bg-sky-950/30">
        <svg viewBox="0 0 100 42" className="w-full h-full overflow-visible">
          {/* Curved trajectory path based on actual pass altitude */}
          <path
            d={`M 12 36 Q 50 ${peakY.toFixed(1)} 88 36`}
            fill="none"
            stroke="var(--color-brass-400)"
            strokeWidth="1.5"
            strokeDasharray="2.5 2.5"
          />

          {/* Directional travel arrow near end */}
          <path
            d="M 82 33 L 88 36 L 82 39"
            fill="none"
            stroke="var(--color-brass-400)"
            strokeWidth="1.5"
          />

          {/* Start Point */}
          <circle
            cx="12"
            cy="36"
            r="2.5"
            fill="var(--color-sky-300)"
            stroke="var(--color-sky-950)"
            strokeWidth="1"
          />

          {/* Peak Point */}
          <circle
            cx="50"
            cy={peakY}
            r="3.5"
            fill="var(--color-brass-300)"
            stroke="var(--color-sky-950)"
            strokeWidth="1"
          />

          {/* End Point */}
          <circle
            cx="88"
            cy="36"
            r="2.5"
            fill="var(--color-sky-300)"
            stroke="var(--color-sky-950)"
            strokeWidth="1"
          />

          {/* Compass and peak labels */}
          <text
            x="12"
            y="42"
            textAnchor="middle"
            className="font-sans fill-sky-300"
            style={{ fontSize: '7.5px' }}
          >
            {startLabel}
          </text>
          <text
            x="50"
            y={Math.max(8, peakY - 4)}
            textAnchor="middle"
            className="font-sans fill-brass-300 font-medium"
            style={{ fontSize: '8px' }}
          >
            {maxLabel}
          </text>
          <text
            x="88"
            y="42"
            textAnchor="middle"
            className="font-sans fill-sky-300"
            style={{ fontSize: '7.5px' }}
          >
            {endLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
