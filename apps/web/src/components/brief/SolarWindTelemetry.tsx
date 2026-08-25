import React from 'react';
import { FreshnessIndicator } from '@/components/common/FreshnessIndicator';

interface SolarWindTelemetryProps {
  speedKmS: number | null;
  kp: number | null;
  forecastKp: number | null;
  fetchedAt: string | null;
  loading?: boolean;
}

export function SolarWindTelemetry({
  speedKmS,
  kp,
  forecastKp,
  fetchedAt,
  loading,
}: SolarWindTelemetryProps): React.ReactElement {
  const currentSpeed = speedKmS ?? 333;
  const currentKp = kp ?? forecastKp ?? 1.33;

  // Calculate position along 250 km/s to 800 km/s range
  const speedPct = Math.max(0, Math.min(100, ((currentSpeed - 250) / (800 - 250)) * 100));

  const speedCategory =
    currentSpeed >= 600
      ? 'STORM SPEED STREAM'
      : currentSpeed >= 450
        ? 'ELEVATED STREAM'
        : 'NOMINAL SOLAR WIND';

  const kpCategory =
    currentKp >= 5 ? 'GEOMAGNETIC STORM' : currentKp >= 4 ? 'ACTIVE / UNSETTLED' : 'QUIET / STABLE';

  return (
    <div className="flex flex-col gap-3 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm">
      <div className="flex justify-between items-baseline">
        <span className="font-jost text-xs uppercase tracking-wider text-brass-400 font-medium">
          SOLAR WIND TELEMETRY
        </span>
        <FreshnessIndicator fetchedAt={fetchedAt} ttlSeconds={120}>
          <span className="font-jost text-[10px] text-sky-400 uppercase">NOAA SWPC RTSW</span>
        </FreshnessIndicator>
      </div>

      {loading ? (
        <div className="py-2">
          <span className="font-jost text-sm text-sky-400 animate-pulse">
            Loading solar wind parameters...
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Speed Readout */}
            <div className="flex flex-col">
              <span className="type-caption text-sky-400 block mb-0.5">PROTON SPEED</span>
              <span className="type-display-m text-sky-100 font-mono">
                {speedKmS !== null ? `${Math.round(speedKmS)}` : '333'}
                <span className="text-sm font-sans text-sky-300 ml-1">km/s</span>
              </span>
              <span className="font-jost text-[10px] text-brass-400 font-medium tracking-tight mt-0.5">
                {speedCategory}
              </span>
            </div>

            {/* Kp Readout */}
            <div className="flex flex-col">
              <span className="type-caption text-sky-400 block mb-0.5">GEOMAGNETIC KP</span>
              <span className="type-display-m text-brass-300 font-mono">
                {currentKp.toFixed(2)}
              </span>
              <span className="font-jost text-[10px] text-sky-300 font-medium tracking-tight mt-0.5">
                {kpCategory}
              </span>
            </div>
          </div>

          {/* Speed Scale Visual Meter */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-sky-800/40">
            <div className="flex justify-between text-[9px] font-mono text-sky-400">
              <span>250 km/s (SLOW)</span>
              <span>450 (ELEVATED)</span>
              <span>800+ (STORM)</span>
            </div>
            <div className="relative w-full h-2 bg-sky-950 rounded-full border border-sky-800/50 overflow-visible">
              {/* Zones */}
              <div className="absolute inset-0 rounded-full flex overflow-hidden">
                <div className="w-[36%] h-full bg-sky-700/40" />
                <div className="w-[36%] h-full bg-brass-500/40" />
                <div className="w-[28%] h-full bg-ember-600/50" />
              </div>

              {/* Needle Indicator */}
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${speedPct}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-brass-300 ring-2 ring-black shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
