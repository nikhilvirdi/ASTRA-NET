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

const TOTAL_TICKS = 8;

export function ConfidenceTicks({
  factors,
  confidenceBand,
}: ConfidenceTicksProps): React.ReactElement {
  if (!factors || !confidenceBand) {
    return (
      <div className="flex flex-col justify-between gap-3 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm h-full">
        <div className="flex justify-between items-center">
          <span className="font-jost text-xs uppercase tracking-wider text-brass-400 font-medium">
            CONFIDENCE
          </span>
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
    { key: 'lead', label: 'Lead' },
    { key: 'agreement', label: 'Agreement' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div
      aria-label={`Confidence level: ${normalizedBand}`}
      className="flex flex-col justify-between gap-4 p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm h-full"
    >
      <div className="flex justify-between items-center">
        <span className="font-jost text-xs uppercase tracking-wider text-brass-400 font-medium">
          CONFIDENCE TICKS
        </span>
        <span className="font-jost text-[10px] text-sky-400 uppercase font-medium">
          CAUSAL CHAIN
        </span>
      </div>

      {/* Discrete 8-tick segmented bars per factor (§7.4) */}
      <div className="flex flex-col gap-3 my-auto">
        {factorKeys.map(({ key, label }) => {
          const val = Math.max(0, Math.min(1, factors[key]));
          const filledCount = Math.max(0, Math.min(TOTAL_TICKS, Math.round(val * TOTAL_TICKS)));

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 group cursor-help"
              title={DESCRIPTIONS[key]}
            >
              <span className="font-jost text-xs text-sky-200 uppercase font-medium tracking-wide flex-shrink-0">
                {label}
              </span>

              {/* 8 Discrete Ticks: ▮▮▮▮▮▯▯▯ */}
              <div
                className="flex items-center gap-1 sm:gap-1.5"
                aria-label={`${label}: ${filledCount} of ${TOTAL_TICKS} ticks`}
              >
                {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
                  const isFilled = i < filledCount;
                  return (
                    <div
                      key={i}
                      className={`w-3 sm:w-4 h-2.5 rounded-[1px] transition-colors ${
                        isFilled ? 'bg-brass-300' : 'bg-sky-950 border border-sky-800/60'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hairline Divider and Qualitative Verdict (§7.4) */}
      <div className="pt-2 border-t border-sky-800/40 flex justify-between items-center">
        <span className="font-jost text-[10px] text-sky-400 uppercase font-medium tracking-wider">
          VERDICT
        </span>
        <span
          className={`font-jost text-xs px-2.5 py-0.5 rounded-sm font-semibold tracking-wider uppercase ${
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
    </div>
  );
}
