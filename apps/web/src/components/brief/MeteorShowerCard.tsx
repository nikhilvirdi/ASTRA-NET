import React from 'react';
import {
  activeShowers,
  formatShowerDate,
  selectPrimaryShower,
  type MeteorShower,
} from '../../lib/meteor-showers';

// Re-exported for existing consumers (MeteorShowerCard.test.ts) — the real
// implementation lives in lib/meteor-showers.ts so lib/brief-headline.ts can
// use it too without a lib -> components dependency.
export { selectPrimaryShower };

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(month: number, day: number): number {
  return (DAYS_BEFORE_MONTH[month - 1] ?? 0) + (day - 1);
}

/**
 * Computes linear progress (0-100%) of peak and current date along the shower's
 * activity window (activeStart → peak → activeEnd).
 *
 * Location-independent calendar day calculation that handles year-wrapping
 * windows (e.g. Quadrantids Dec 28 – Jan 12).
 */
export function computeActivityProgress(
  activeStart: { month: number; day: number },
  activeEnd: { month: number; day: number },
  peak: { month: number; day: number },
  current: { month: number; day: number },
): { peakPct: number; todayPct: number } {
  const startDay = dayOfYear(activeStart.month, activeStart.day);
  const endDay = dayOfYear(activeEnd.month, activeEnd.day);
  const peakDay = dayOfYear(peak.month, peak.day);
  const currentDay = dayOfYear(current.month, current.day);

  const totalDays = endDay >= startDay ? endDay - startDay : 365 - startDay + endDay;
  if (totalDays <= 0) return { peakPct: 50, todayPct: 50 };

  const peakOffset = peakDay >= startDay ? peakDay - startDay : 365 - startDay + peakDay;
  const currentOffset =
    currentDay >= startDay ? currentDay - startDay : 365 - startDay + currentDay;

  const peakPct = Math.max(0, Math.min(100, (peakOffset / totalDays) * 100));
  const todayPct = Math.max(0, Math.min(100, (currentOffset / totalDays) * 100));

  return { peakPct, todayPct };
}

export interface MeteorShowerCardProps {
  date?: Date;
  observerLonEastDeg?: number;
  moonIlluminatedFraction?: number | null;
  /** Optional shower override for tests or stories */
  shower?: MeteorShower | null;
}

export function MeteorShowerCard({
  date,
  observerLonEastDeg = 0,
  moonIlluminatedFraction,
  shower,
}: MeteorShowerCardProps): React.ReactElement | null {
  const currentDate = date ?? new Date();

  // If a specific shower was passed, use it; otherwise find active showers for this observer date
  const activeShower =
    shower !== undefined
      ? shower
      : selectPrimaryShower(activeShowers(currentDate, observerLonEastDeg));

  // "If no currently-active shower exists for today's date, the whole widget should not render at all"
  if (!activeShower) {
    return null;
  }

  // Location-independent calendar date for Activity Window timeline
  const currentCalendar = {
    month: currentDate.getUTCMonth() + 1,
    day: currentDate.getUTCDate(),
  };

  const { peakPct, todayPct } = computeActivityProgress(
    activeShower.activeStart,
    activeShower.activeEnd,
    activeShower.peak,
    currentCalendar,
  );

  // Clamped for indicator needle inside track padding
  const todayDisplayPct = Math.max(2, Math.min(98, todayPct));

  // Moonlight interference percentage (0-100)
  const moonPct =
    moonIlluminatedFraction != null && !isNaN(moonIlluminatedFraction)
      ? Math.max(0, Math.min(100, Math.round(moonIlluminatedFraction * 1000) / 10))
      : null;

  const moonCategory =
    moonPct !== null
      ? moonPct > 75
        ? 'FULL WASHOUT'
        : moonPct > 25
          ? 'MODERATE'
          : 'DARK SKY'
      : null;

  return (
    <article className="py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex justify-between items-baseline gap-2">
        <h2 className="font-jost text-xl sm:text-2xl md:text-3xl text-white font-medium tracking-tight">
          Meteor Shower
        </h2>
        <span className="font-jost text-xs sm:text-sm font-semibold tracking-wider text-aurora whitespace-nowrap">
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* ── Element a: Activity Window Bar (reusing NeoDistanceScale.tsx styling) ── */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex justify-between items-baseline gap-2 flex-wrap sm:flex-nowrap">
            <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
              ACTIVITY WINDOW
            </span>
            <span className="font-sans text-xs text-brass-300 font-medium">
              {activeShower.name} · ZHR {activeShower.zhr}
            </span>
          </div>

          <div className="relative w-full pt-8 md:pt-4 pb-7 px-3 bg-sky-950/40 border border-sky-800/50 rounded-sm">
            {/* Track Rail */}
            <div className="relative w-full h-1.5 bg-sky-900/60 rounded-full overflow-visible">
              {/* Progress fill up to today */}
              <div
                className="absolute top-0 left-0 h-full bg-sky-700/50 rounded-l-full"
                style={{ width: `${todayPct}%` }}
              />

              {/* Start Anchor */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 z-10 flex flex-col items-start">
                <div className="w-3 h-3 rounded-full bg-sky-400 ring-2 ring-black flex items-center justify-center -translate-x-1/2" />
                <span className="font-jost text-[8.5px] sm:text-[9px] text-sky-300 whitespace-nowrap mt-1 font-medium">
                  START ({formatShowerDate(activeShower.activeStart).toUpperCase()})
                </span>
              </div>

              {/* Peak Reference Line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
                style={{ left: `${peakPct}%` }}
              >
                <div className="w-[1px] h-4 bg-sky-400/80 -translate-y-0.5 -translate-x-1/2" />
                <div className="w-2 h-2 rounded-full bg-sky-200 ring-2 ring-black -translate-x-1/2" />
                <span className="font-jost text-[8.5px] sm:text-[9px] text-sky-300 whitespace-nowrap mt-1 font-medium -translate-x-1/2">
                  PEAK ({formatShowerDate(activeShower.peak).toUpperCase()})
                </span>
              </div>

              {/* End Anchor */}
              <div className="absolute top-1/2 right-0 -translate-y-1/2 z-10 flex flex-col items-end">
                <div className="w-3 h-3 rounded-full bg-sky-400 ring-2 ring-black flex items-center justify-center translate-x-1/2" />
                <span className="font-jost text-[8.5px] sm:text-[9px] text-sky-300 whitespace-nowrap mt-1 font-medium">
                  END ({formatShowerDate(activeShower.activeEnd).toUpperCase()})
                </span>
              </div>

              {/* Today Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                style={{ left: `${todayDisplayPct}%` }}
              >
                <div className="w-3.5 h-3.5 rounded-full ring-2 ring-black flex items-center justify-center -translate-x-1/2 bg-brass-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
                <div
                  className="absolute -top-5 md:-top-6 flex flex-col items-center whitespace-nowrap"
                  style={{
                    transform:
                      todayDisplayPct < 15
                        ? 'translateX(0%)'
                        : todayDisplayPct > 85
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                  }}
                >
                  <span className="font-jost text-[9.5px] font-semibold uppercase px-1 py-0.5 rounded-sm border text-brass-300 bg-sky-950/90 border-brass-500/40">
                    TODAY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Element b: Moonlight Interference Gauge (reusing SolarWindTelemetry.tsx styling) ── */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex justify-between items-baseline gap-2 flex-wrap sm:flex-nowrap">
            <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
              MOONLIGHT INTERFERENCE
            </span>
            <span className="font-sans text-xs text-brass-300 font-medium">
              {moonPct !== null ? `${Math.round(moonPct)}% (${moonCategory})` : '—'}
            </span>
          </div>

          <div className="relative w-full pt-4 pb-7 px-3 bg-sky-950/40 border border-sky-800/50 rounded-sm flex flex-col justify-center">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] font-sans text-sky-400 font-medium">
                <span>0% (DARK SKY)</span>
                <span>50% (MODERATE)</span>
                <span>100% (FULL WASHOUT)</span>
              </div>
              <div className="relative w-full h-2 bg-sky-950 rounded-full border border-sky-800/50 overflow-visible">
                {/* Threshold Zones */}
                <div className="absolute inset-0 rounded-full flex overflow-hidden">
                  <div className="w-[25%] h-full bg-sky-700/40" />
                  <div className="w-[50%] h-full bg-brass-500/40" />
                  <div className="w-[25%] h-full bg-ember-600/50" />
                </div>

                {/* Needle Indicator */}
                {moonPct !== null && (
                  <div
                    data-testid="moon-interference-needle"
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${moonPct}%` }}
                  >
                    <div className="w-3 h-3 rounded-full bg-brass-300 ring-2 ring-black" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// Alias to ensure both naming conventions resolve seamlessly
export const MeteorShowerWidget = MeteorShowerCard;
