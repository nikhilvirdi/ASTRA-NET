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
      <div className="type-micro text-brass-500 text-xs tracking-wider uppercase">
        CONFIDENCE: UNCALIBRATED (NO ACTIVE CME)
      </div>
    );
  }

  const factorKeys: Array<{ key: keyof typeof factors; label: string }> = [
    { key: 'lead', label: 'LEAD' },
    { key: 'agreement', label: 'AGREEMENT' },
    { key: 'history', label: 'HISTORY' },
  ];

  return (
    <div
      aria-label={`Confidence level: ${confidenceBand}`}
      className="flex flex-col gap-2 p-3 bg-sky-900/40 border border-sky-800/60 rounded"
    >
      <div className="flex justify-between items-center">
        <span className="type-micro text-brass-500 text-xs uppercase tracking-wider">
          CAUSAL CONFIDENCE
        </span>
        <span
          className={`type-micro text-xs px-2 py-0.5 rounded font-semibold ${
            confidenceBand === 'HIGH'
              ? 'text-emerald-400 bg-emerald-950/60'
              : confidenceBand === 'MODERATE'
                ? 'text-brass-300 bg-brass-950/60'
                : 'text-amber-400 bg-amber-950/60'
          }`}
        >
          {confidenceBand}
        </span>
      </div>

      {/* 3 Factor Bars */}
      <div className="flex flex-col gap-1.5 mt-1">
        {factorKeys.map(({ key, label }) => {
          const val = Math.max(0, Math.min(1, factors[key]));
          const barCount = 8;
          const filledCount = Math.round(val * barCount);

          return (
            <div
              key={key}
              className="flex justify-between items-center group cursor-help text-xs"
              title={DESCRIPTIONS[key]}
            >
              <span className="type-micro text-sky-300 w-24 text-[11px] uppercase">{label}</span>
              <div className="flex gap-1 items-center flex-1 max-w-[120px]">
                {Array.from({ length: barCount }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-2 rounded-sm transition-colors ${
                      i < filledCount ? 'bg-brass-300' : 'bg-sky-800/50'
                    }`}
                  />
                ))}
              </div>
              <span className="type-mono text-[11px] text-brass-500 w-10 text-right">
                {(val * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
