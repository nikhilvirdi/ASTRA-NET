import React from 'react';
import { useAppStore } from '@/store';
import { formatTime } from '@/lib/format-preferences';

interface MoonTimelineProps {
  nextRiseUtc: string | null | undefined;
  nextSetUtc: string | null | undefined;
  loading?: boolean;
}

export function MoonTimeline({
  nextRiseUtc,
  nextSetUtc,
  loading,
}: MoonTimelineProps): React.ReactElement {
  const timeFormat = useAppStore((s) => s.timeFormat);
  const now = new Date();
  const startMs = now.getTime() - 6 * 3600 * 1000;
  const totalMs = 24 * 3600 * 1000;

  const nowPct = 25; // (-6h to +18h puts 'now' at 6h / 24h = 25%)

  let risePct: number | null = null;
  let setPct: number | null = null;

  if (nextRiseUtc) {
    const riseMs = new Date(nextRiseUtc).getTime();
    if (!isNaN(riseMs)) {
      const p = ((riseMs - startMs) / totalMs) * 100;
      risePct = Math.max(2, Math.min(98, p));
    }
  }

  if (nextSetUtc) {
    const setMs = new Date(nextSetUtc).getTime();
    if (!isNaN(setMs)) {
      const p = ((setMs - startMs) / totalMs) * 100;
      setPct = Math.max(2, Math.min(98, p));
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-baseline">
        <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
          MOONRISE & MOONSET TIMELINE
        </span>
        <span className="font-jost text-xs text-sky-400 uppercase font-medium">24-HOUR WINDOW</span>
      </div>

      <div className="relative w-full pt-4 pb-6 px-2 bg-sky-950/40 border border-sky-800/40 rounded-sm">
        {/* Timeline base track */}
        <div className="relative w-full h-1.5 bg-sky-800/60 rounded-full overflow-visible">
          {/* Moon illuminated active arc span between rise and set if both on track */}
          {risePct !== null && setPct !== null && (
            <div
              className="absolute top-0 h-full bg-brass-400/30"
              style={{
                left: `${Math.min(risePct, setPct)}%`,
                width: `${Math.abs(setPct - risePct)}%`,
              }}
            />
          )}

          {/* Hour markers (every 6 hours) */}
          {[0, 25, 50, 75, 100].map((tickPct, idx) => (
            <div
              key={idx}
              className="absolute top-0 w-[1px] h-3 -translate-y-1 bg-sky-700/60"
              style={{ left: `${tickPct}%` }}
            />
          ))}

          {/* NOW marker */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            style={{ left: `${nowPct}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-aurora ring-2 ring-black" />
            <span className="font-jost text-[10px] font-semibold text-aurora whitespace-nowrap mt-1 uppercase">
              NOW
            </span>
          </div>

          {/* Moonrise Marker */}
          {!loading && risePct !== null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
              style={{ left: `${risePct}%` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-brass-300 ring-2 ring-black flex items-center justify-center" />
              <div className="absolute top-3 flex flex-col items-center whitespace-nowrap">
                <span className="font-sans text-[10px] font-medium text-brass-300">
                  ↑ {formatTime(nextRiseUtc, timeFormat)}
                </span>
                <span className="font-jost text-[8px] text-brass-500 uppercase tracking-tighter">
                  MOONRISE
                </span>
              </div>
            </div>
          )}

          {/* Moonset Marker */}
          {!loading && setPct !== null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
              style={{ left: `${setPct}%` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-sky-200 ring-2 ring-black flex items-center justify-center" />
              <div className="absolute top-3 flex flex-col items-center whitespace-nowrap">
                <span className="font-sans text-[10px] font-medium text-sky-200">
                  ↓ {formatTime(nextSetUtc, timeFormat)}
                </span>
                <span className="font-jost text-[8px] text-sky-400 uppercase tracking-tighter">
                  MOONSET
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
