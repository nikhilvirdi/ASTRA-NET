import React from 'react';

interface NeoSizeComparisonProps {
  diameterKm: number | null;
  name: string;
  isPotentiallyHazardous: boolean;
  velocityKmS: number;
}

export function NeoSizeComparison({
  diameterKm,
  name,
  isPotentiallyHazardous,
  velocityKmS,
}: NeoSizeComparisonProps): React.ReactElement {
  const meters = diameterKm ? Math.round(diameterKm * 1000) : 300;

  // Comparison landmark based on size
  let comparisonLabel = 'Eiffel Tower (300m)';
  if (meters < 50) {
    comparisonLabel = 'Blue Whale (30m)';
  } else if (meters < 150) {
    comparisonLabel = 'Statue of Liberty (93m)';
  } else if (meters < 450) {
    comparisonLabel = 'Eiffel Tower (300m)';
  } else if (meters < 900) {
    comparisonLabel = 'Burj Khalifa (830m)';
  } else {
    comparisonLabel = `${(meters / 1000).toFixed(1)}km Mountain Scale`;
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-sky-950/40 border border-sky-800/50 rounded-sm">
      <div className="flex justify-between items-baseline">
        <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
          OBJECT & SCALE
        </span>
        <span
          className={`font-jost text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-sm border ${
            isPotentiallyHazardous
              ? 'text-ember-400 bg-ember-950/50 border-ember-600/50'
              : 'text-aurora bg-aurora/10 border-aurora/30'
          }`}
        >
          {isPotentiallyHazardous ? 'POTENTIALLY HAZARDOUS' : 'NON-HAZARDOUS'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-sans text-xl sm:text-2xl text-sky-100 font-medium tracking-tight">
            {name}
          </span>
          <span className="font-sans text-xs text-sky-300 font-normal">
            ~{meters}m wide · comparable to {comparisonLabel}
          </span>
        </div>

        {/* Asteroid Icon & Velocity */}
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="flex items-center gap-1.5 text-brass-300 font-sans text-xs font-medium">
            <svg
              viewBox="0 0 20 20"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M7 3l6 2 4 5-2 6-7 2-5-4 1-8 3-3z" fill="var(--color-sky-900)" />
              <circle cx="8" cy="8" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span>{velocityKmS.toFixed(1)} km/s</span>
          </div>
          <span className="font-jost text-[9px] text-sky-400 font-medium uppercase">
            REL VELOCITY
          </span>
        </div>
      </div>
    </div>
  );
}
