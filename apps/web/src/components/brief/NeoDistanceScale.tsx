import React from 'react';
import { useAppStore } from '@/store';
import { formatMillionsDistance } from '@/lib/format-preferences';

interface NeoDistanceScaleProps {
  missDistanceLunarDistances: number;
  missDistanceKm: number;
  isPotentiallyHazardous?: boolean;
}

// Convert Lunar Distances to non-linear percentage on scale (0 LD to 20 LD)
// 0 LD -> 0%, 1 LD (Moon) -> 20%, 5 LD -> 52%, 10 LD -> 74%, 20 LD -> 100%
function ldToPercent(ld: number): number {
  if (ld <= 0) return 0;
  // Piecewise smooth power curve: (ld / 20)^0.55 * 100
  const normalized = Math.min(1, Math.max(0, ld / 20));
  return Math.pow(normalized, 0.55) * 100;
}

export function NeoDistanceScale({
  missDistanceLunarDistances,
  missDistanceKm,
  isPotentiallyHazardous,
}: NeoDistanceScaleProps): React.ReactElement {
  const units = useAppStore((s) => s.units);
  const ld = missDistanceLunarDistances;
  const neoPct = Math.max(2, Math.min(98, ldToPercent(ld)));
  const moonPct = ldToPercent(1); // approx 19.3%

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-baseline">
        <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
          MISS DISTANCE SCALE
        </span>
        <span className="font-sans text-xs text-brass-300 font-medium">
          {ld.toFixed(1)} LD ({formatMillionsDistance(missDistanceKm, units, 2)})
        </span>
      </div>

      <div className="relative w-full pt-4 pb-7 px-3 bg-sky-950/40 border border-sky-800/50 rounded-sm">
        {/* Track Rail */}
        <div className="relative w-full h-1.5 bg-sky-900/60 rounded-full overflow-visible">
          {/* Earth-Moon Safe Zone / Danger zone */}
          <div
            className="absolute top-0 left-0 h-full bg-ember-600/30 rounded-l-full"
            style={{ width: `${moonPct}%` }}
          />

          {/* Earth Anchor (0 LD) */}
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-sky-400 ring-2 ring-black flex items-center justify-center" />
            <span className="font-jost text-[9px] text-sky-300 whitespace-nowrap mt-1 font-medium">
              EARTH (0 LD)
            </span>
          </div>

          {/* Moon Orbit Reference Line (1 LD) */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            style={{ left: `${moonPct}%` }}
          >
            <div className="w-[1px] h-4 bg-sky-400/80 -translate-y-0.5" />
            <div className="w-2 h-2 rounded-full bg-sky-200 ring-2 ring-black" />
            <span className="font-jost text-[9px] text-sky-300 whitespace-nowrap mt-1 font-medium">
              MOON (1 LD)
            </span>
          </div>

          {/* 5 LD Tick */}
          <div
            className="absolute top-0 w-[1px] h-2.5 -translate-y-0.5 bg-sky-700/50"
            style={{ left: `${ldToPercent(5)}%` }}
          >
            <span className="absolute top-3 -translate-x-1/2 font-jost text-[8px] text-sky-500">
              5 LD
            </span>
          </div>

          {/* 10 LD Tick */}
          <div
            className="absolute top-0 w-[1px] h-2.5 -translate-y-0.5 bg-sky-700/50"
            style={{ left: `${ldToPercent(10)}%` }}
          >
            <span className="absolute top-3 -translate-x-1/2 font-jost text-[8px] text-sky-500">
              10 LD
            </span>
          </div>

          {/* 20 LD Tick */}
          <div className="absolute top-0 right-0 w-[1px] h-2.5 -translate-y-0.5 bg-sky-700/50">
            <span className="absolute top-3 -translate-x-full font-jost text-[8px] text-sky-500">
              20+ LD
            </span>
          </div>

          {/* NEO Marker */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            style={{ left: `${neoPct}%` }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full ring-2 ring-black flex items-center justify-center ${
                isPotentiallyHazardous ? 'bg-ember-400' : 'bg-brass-300'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-black" />
            </div>
            <div className="absolute -top-5 flex flex-col items-center whitespace-nowrap">
              <span
                className={`font-jost text-[9.5px] font-semibold uppercase px-1 py-0.5 rounded-sm border ${
                  isPotentiallyHazardous
                    ? 'text-ember-300 bg-ember-950/90 border-ember-600/60'
                    : 'text-brass-300 bg-sky-950/90 border-brass-500/40'
                }`}
              >
                NEO {ld.toFixed(1)} LD
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
