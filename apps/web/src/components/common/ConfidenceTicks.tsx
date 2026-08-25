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
      <div className="flex flex-col gap-2 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm">
        <span className="font-jost text-xs text-brass-400 uppercase tracking-wider font-medium">
          CAUSAL CONFIDENCE
        </span>
        <span className="font-jost text-xs text-sky-400">UNCALIBRATED (NO ACTIVE CME EVENT)</span>
      </div>
    );
  }

  const factorKeys: Array<{ key: keyof typeof factors; label: string }> = [
    { key: 'lead', label: 'LEAD TIME' },
    { key: 'agreement', label: 'AGREEMENT' },
    { key: 'history', label: 'HISTORY' },
  ];

  return (
    <div
      aria-label={`Confidence level: ${confidenceBand}`}
      className="flex flex-col gap-3 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm"
    >
      <div className="flex justify-between items-center">
        <span className="font-jost text-xs text-brass-400 uppercase tracking-wider font-medium">
          CAUSAL CONFIDENCE
        </span>
        <span
          className={`font-jost text-xs px-2.5 py-0.5 rounded-sm font-semibold tracking-wide ${
            confidenceBand === 'HIGH'
              ? 'text-aurora bg-aurora/15 border border-aurora/40'
              : confidenceBand === 'MODERATE'
                ? 'text-brass-300 bg-brass-300/10 border border-brass-400/30'
                : 'text-ember-400 bg-ember-400/15 border border-ember-400/40'
          }`}
        >
          {confidenceBand}
        </span>
      </div>

      {/* 3 Factor Bars (per DESIGN_SPEC.md §7.4: Bars and verdict word, zero raw numbers) */}
      <div className="flex flex-col gap-2.5 mt-1">
        {factorKeys.map(({ key, label }) => {
          const val = Math.max(0, Math.min(1, factors[key]));
          const barCount = 10;
          const filledCount = Math.round(val * barCount);

          return (
            <div
              key={key}
              className="flex justify-between items-center group cursor-help"
              title={DESCRIPTIONS[key]}
            >
              <span className="font-jost text-xs text-sky-200 w-28 uppercase font-medium">
                {label}
              </span>
              <div className="flex gap-1 items-center flex-1 max-w-[160px] justify-end">
                {Array.from({ length: barCount }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-2.5 rounded-none transition-colors ${
                      i < filledCount
                        ? confidenceBand === 'HIGH'
                          ? 'bg-aurora'
                          : confidenceBand === 'MODERATE'
                            ? 'bg-brass-300'
                            : 'bg-ember-400'
                        : 'bg-sky-900/60'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
