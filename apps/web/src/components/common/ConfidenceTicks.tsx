import React from 'react';
import type { ConfidenceBand } from '@/lib/api';

interface ConfidenceTicksProps {
  factors: {
    lead: number;
    agreement: number;
    history: number;
  } | null;
  confidenceBand: ConfidenceBand | null;
}

const DESCRIPTIONS: Record<string, string> = {
  lead: "How far ahead we're predicting",
  agreement: 'How well the two forecasts agree',
  history: "How often we've been right before",
};

export function ConfidenceTicks({
  factors,
  confidenceBand,
}: ConfidenceTicksProps): React.ReactElement {
  if (!factors || !confidenceBand) {
    return (
      <div className="flex flex-col justify-between gap-3 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm h-full">
        <div className="flex justify-between items-center">
          <h3 className="font-jost text-base sm:text-lg text-white font-medium tracking-tight">
            Causal Confidence
          </h3>
          <span className="font-jost text-xs px-2.5 py-0.5 rounded-sm font-semibold tracking-wide uppercase text-sky-400 bg-sky-900/30 border border-sky-800/50">
            UNCALIBRATED
          </span>
        </div>
        <div className="py-8 flex items-center justify-center">
          <span className="font-jost text-xs text-sky-400 uppercase tracking-wider text-center">
            UNCALIBRATED (NO ACTIVE CME EVENT)
          </span>
        </div>
      </div>
    );
  }

  const normalizedBand = confidenceBand.toUpperCase() as ConfidenceBand;

  const factorKeys: Array<{ key: keyof typeof factors; label: string }> = [
    { key: 'lead', label: 'LEAD TIME' },
    { key: 'agreement', label: 'AGREEMENT' },
    { key: 'history', label: 'HISTORY' },
  ];

  return (
    <div
      aria-label={`Confidence level: ${normalizedBand}`}
      className="flex flex-col justify-between gap-4 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm h-full"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-jost text-base sm:text-lg text-white font-medium tracking-tight">
          Causal Confidence
        </h3>
        <span
          className={`font-jost text-xs px-2.5 py-0.5 rounded-sm font-semibold tracking-wide uppercase ${
            normalizedBand === 'HIGH'
              ? 'text-aurora bg-aurora/15 border border-aurora/40'
              : normalizedBand === 'MODERATE'
                ? 'text-brass-300 bg-brass-300/10 border border-brass-400/30'
                : 'text-ember-400 bg-ember-400/15 border border-ember-400/40'
          }`}
        >
          {normalizedBand}
        </span>
      </div>

      {/* 3 Factor Sliders matching Solar Wind pattern */}
      <div className="flex flex-col gap-3.5 my-auto">
        {factorKeys.map(({ key, label }) => {
          const val = Math.max(0, Math.min(1, factors[key]));
          const pct = Math.max(2, Math.min(98, val * 100));

          // Indicator color based on factor strength zone
          const dotColor = val >= 0.7 ? 'bg-aurora' : val >= 0.4 ? 'bg-brass-300' : 'bg-ember-400';

          return (
            <div
              key={key}
              className="flex items-center gap-3 group cursor-help"
              title={DESCRIPTIONS[key]}
            >
              <span className="font-jost text-xs text-sky-200 w-24 sm:w-28 uppercase font-medium tracking-wide flex-shrink-0">
                {label}
              </span>

              <div className="flex flex-col gap-1 flex-1">
                {/* Horizontal Track with Ember -> Brass -> Aurora Zones */}
                <div className="relative w-full h-2 bg-sky-950 rounded-full border border-sky-800/50 overflow-visible">
                  <div className="absolute inset-0 rounded-full flex overflow-hidden">
                    <div className="w-[40%] h-full bg-ember-600/40" />
                    <div className="w-[30%] h-full bg-brass-500/40" />
                    <div className="w-[30%] h-full bg-aurora/30" />
                  </div>

                  {/* Marker Dot */}
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${pct}%` }}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ring-2 ring-black shadow-sm ${dotColor}`}
                    />
                  </div>
                </div>

                {/* Zone Labels below track */}
                <div className="flex justify-between text-[8px] font-sans text-sky-400/90 font-medium tracking-wider">
                  <span>LOW</span>
                  <span>MODERATE</span>
                  <span>HIGH</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
