import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AuroraCardData } from '@/lib/api';

interface CausalChainFlowProps {
  aurora: AuroraCardData | null;
  loading?: boolean;
}

// Engraved SVG Glyphs (§8.1)
function SunFlareIcon({ className = 'w-4 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2.5M10 15.5v2.5M2 10h2.5M15.5 10h2.5M4.34 4.34l1.77 1.77M13.89 13.89l1.77 1.77M4.34 15.66l1.77-1.77M13.89 6.11l1.77-1.77" />
    </svg>
  );
}

function InterplanetaryWaveIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 10h14M13 6l4 4-4 4" />
      <path d="M6 5c1.5 2 1.5 8 0 10M10 3c2 3 2 11 0 14" strokeDasharray="2 2" />
    </svg>
  );
}

function MagnetosphereIcon({ className = 'w-4 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="10" r="3" />
      <path d="M11.5 5c2.5 2.5 2.5 7.5 0 10M14.5 3c3.5 3.5 3.5 10.5 0 14" />
    </svg>
  );
}

function AuroraOutcomeIcon({
  active,
  className = 'w-4 h-4',
}: {
  active: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {active ? (
        <path d="M2 14c3-4 6-2 9-5s5 1 7-3M2 17c3-3 6-1 9-4s5 2 7-2" />
      ) : (
        <path d="M10 4v12M4 10h12" strokeDasharray="2.5 2.5" />
      )}
    </svg>
  );
}

export function CausalChainFlow({ aurora, loading }: CausalChainFlowProps): React.ReactElement {
  const [now, setNow] = useState<Date>(() => new Date());

  // Periodically advance `now` so the transit marker dynamically updates with live time
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute CME transit percentage from real physical timestamps (called unconditionally at top)
  const { progressPct, hasActiveTransit } = useMemo(() => {
    if (!aurora || !aurora.hasActiveCme || !aurora.cmeArrivalTime) {
      return { progressPct: 0, hasActiveTransit: false };
    }

    const arrivalMs = new Date(aurora.cmeArrivalTime).getTime();
    if (isNaN(arrivalMs)) {
      return { progressPct: 0, hasActiveTransit: false };
    }

    const leadHours = aurora.leadHours ?? 24;
    const totalTransitHours = Math.max(48, leadHours * 1.6);
    const startMs = arrivalMs - totalTransitHours * 3600 * 1000;
    const currentMs = now.getTime();

    if (currentMs < startMs) {
      return { progressPct: 3, hasActiveTransit: true };
    }
    if (currentMs >= arrivalMs) {
      return { progressPct: 98, hasActiveTransit: true };
    }

    const ratio = (currentMs - startMs) / (arrivalMs - startMs);
    const clampedPct = Math.max(3, Math.min(97, ratio * 100));
    return { progressPct: clampedPct, hasActiveTransit: true };
  }, [aurora, now]);

  if (loading) {
    return (
      <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-sm">
        <span className="font-jost text-sm text-sky-400 animate-pulse">
          Evaluating solar causal chain & geomagnetic forecasts...
        </span>
      </div>
    );
  }

  if (!aurora) {
    return (
      <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-sm">
        <span className="font-jost text-sm text-sky-400">
          Causal chain data currently unavailable from NOAA SWPC.
        </span>
      </div>
    );
  }

  const arrivalText = aurora.cmeArrivalTime
    ? `ARRIVING ${new Date(aurora.cmeArrivalTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()} ±6H`
    : 'CME PROPAGATING';

  const stages = [
    {
      id: 'eruption',
      pct: 0,
      label: 'STAGE 1 · ERUPTION',
      title: aurora.hasActiveCme ? 'CME DETECTED' : 'QUIET SUN',
      detail: aurora.hasActiveCme ? 'Active Solar Flare / CME' : 'No active storm detected',
      icon: <SunFlareIcon className={aurora.hasActiveCme ? 'text-ember-400' : 'text-sky-400'} />,
      activeColor: aurora.hasActiveCme ? 'text-ember-300' : 'text-sky-300',
    },
    {
      id: 'propagation',
      pct: 33,
      label: 'STAGE 2 · PROPAGATION',
      title: aurora.hasActiveCme ? arrivalText : 'BASE SOLAR WIND',
      detail: aurora.hasActiveCme ? 'Interplanetary Shock Front' : 'Ambient particle stream',
      icon: (
        <InterplanetaryWaveIcon
          className={aurora.hasActiveCme ? 'text-brass-300' : 'text-sky-400'}
        />
      ),
      activeColor: aurora.hasActiveCme ? 'text-brass-300' : 'text-sky-300',
    },
    {
      id: 'geomagnetic',
      pct: 66,
      label: 'STAGE 3 · GEOMAGNETIC',
      title: `Kp ${aurora.kpPredicted} PREDICTED`,
      detail: aurora.kpPredicted >= 5 ? 'Storm-Level Disturbance' : 'Minor / Quiet Fluctuation',
      icon: (
        <MagnetosphereIcon
          className={aurora.kpPredicted >= 5 ? 'text-brass-200' : 'text-sky-400'}
        />
      ),
      activeColor: aurora.kpPredicted >= 5 ? 'text-brass-200' : 'text-sky-200',
    },
    {
      id: 'outcome',
      pct: 100,
      label: 'STAGE 4 · LOCAL OUTCOME',
      title: aurora.visible ? 'AURORA POSSIBLE' : 'AURORA UNLIKELY',
      detail: aurora.visible ? 'At your geomagnetic latitude' : 'Below visibility threshold',
      icon: (
        <AuroraOutcomeIcon
          active={aurora.visible}
          className={aurora.visible ? 'text-aurora' : 'text-sky-400'}
        />
      ),
      activeColor: aurora.visible ? 'text-aurora' : 'text-sky-400',
    },
  ];

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-baseline">
        <span className="font-jost text-xs uppercase tracking-wider text-sky-400 block font-medium">
          CAUSAL PROPAGATION PIPELINE
        </span>
        <span className="font-jost text-xs text-brass-400 font-medium uppercase">
          SOLAR TO LOCAL
        </span>
      </div>

      <div className="p-4 sm:p-5 bg-sky-950/40 border border-sky-800/50 rounded-sm flex flex-col gap-6 relative overflow-hidden">
        {/* Horizontal Transit Timeline Track */}
        <div className="relative w-full pt-6 pb-2 px-1">
          {/* Base rail spanning Sun to Earth */}
          <div className="relative w-full h-2 bg-sky-950 rounded-full border border-sky-800/60 overflow-visible">
            {/* Active transit progress fill */}
            {hasActiveTransit && (
              <motion.div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-ember-500 via-brass-400 to-aurora rounded-l-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.0, ease: 'easeOut' }}
              />
            )}

            {/* 4 Stage Anchor Nodes */}
            {stages.map((stage) => {
              const isPassed = hasActiveTransit && progressPct >= stage.pct;
              return (
                <div
                  key={stage.id}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                  style={{
                    left: `${stage.pct}%`,
                    transform: `translate(${stage.pct === 0 ? '0%' : stage.pct === 100 ? '-100%' : '-50%'}, -50%)`,
                  }}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full ring-2 ring-black flex items-center justify-center transition-colors ${
                      isPassed ? 'bg-brass-300' : 'bg-sky-800 border border-sky-700'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  </div>
                </div>
              );
            })}

            {/* Live Moving CME Transit Front Marker */}
            {hasActiveTransit && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none"
                style={{ left: `${progressPct}%` }}
                initial={false}
                animate={{ left: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                {/* Floating Tag */}
                <div className="absolute -top-7 whitespace-nowrap px-1.5 py-0.5 rounded-sm bg-ember-950/90 border border-ember-500/60 text-ember-300 font-jost text-[9px] font-semibold tracking-wider uppercase shadow-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ember-400 animate-ping" />
                  CME FRONT · {Math.round(progressPct)}%
                </div>

                {/* Glowing Pulse Marker Dot */}
                <div className="w-4 h-4 rounded-full bg-ember-400 ring-2 ring-black shadow-[0_0_10px_rgba(224,97,76,0.6)] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* 4 Stage Annotations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex flex-col gap-1 p-2.5 rounded-sm bg-sky-900/20 border border-sky-800/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-jost text-[9.5px] uppercase font-medium tracking-wider text-sky-400">
                  {stage.label}
                </span>
                <div className="flex-shrink-0">{stage.icon}</div>
              </div>

              <span
                className={`font-sans text-xs sm:text-sm font-semibold tracking-tight ${stage.activeColor}`}
              >
                {stage.title}
              </span>
              <span className="font-sans text-[10px] text-sky-400/90 font-normal">
                {stage.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
