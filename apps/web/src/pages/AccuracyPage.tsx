import React, { useEffect, useState } from 'react';
import { fetchAccuracy, type AccuracyPayloadData } from '@/lib/api';
import { generateStepPlotPaths } from '@/lib/phase10-helpers';

/** AccuracyPage — /accuracy · Public Track Record · Phase 10 · DESIGN_SPEC.md §14 */
export function AccuracyPage(): React.ReactElement {
  const [payload, setPayload] = useState<AccuracyPayloadData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchAccuracy()
      .then((data) => {
        if (!mounted) return;
        setPayload(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[AccuracyPage] fetch error:', err);
        setError('Failed to load prediction track record.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const hitRate = payload?.hitRate;
  const series = payload?.series ?? [];
  const isEmpty = payload?.empty ?? true;

  const chart = generateStepPlotPaths(series, 750, 320, 40);

  return (
    <main
      id="main-content"
      className="pt-16 pb-24 px-4 sm:px-8 max-w-4xl mx-auto flex flex-col min-h-screen select-none"
      aria-label="Track Record"
    >
      {/* Header Section */}
      <div className="border-b border-sky-800/40 pb-8 mb-10">
        <span className="type-micro text-brass-500 uppercase tracking-widest block mb-1">
          PUBLIC TRACK RECORD · PHASE 10
        </span>
        <h1 className="type-display-l text-sky-100 font-serif">Accuracy</h1>
        <p className="type-body text-sky-300 text-sm mt-1 max-w-2xl">
          Complete, unedited historical record of predicted versus actual Kp geomagnetic indices.
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center font-mono text-xs text-sky-400 animate-pulse">
          LOADING ACCURACY RECORD...
        </div>
      )}

      {error && (
        <div className="p-4 bg-sky-950 border border-ember-400/40 text-xs font-mono text-ember-400 mb-8 text-center">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-12">
          {/* DESIGN_SPEC.md §14 — Rolling Hit-Rate Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between border-b border-sky-800/40 pb-8 gap-6">
            <div>
              <span className="type-display-l font-mono text-brass-300 block">
                {hitRate ? `${(hitRate.rate * 100).toFixed(1)}%` : '—'}
              </span>
              <span className="type-caption text-sky-400 uppercase tracking-wider block mt-1">
                ROLLING HIT-RATE ({hitRate?.hits ?? 0} / {hitRate?.trials ?? 0} TRIALS)
              </span>
            </div>

            <p className="type-body font-serif italic text-sky-300 text-sm max-w-md leading-relaxed">
              Early predictions start from a neutral prior rather than a perfect score, so this
              number is honest from day one.
            </p>
          </div>

          {/* DESIGN_SPEC.md §14 — Constraint: NO cherry-picking controls */}
          <div className="flex justify-between items-center text-xs font-mono text-sky-400">
            <span>PREDICTED VS ACTUAL Kp INDEX (FULL RECORD)</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-brass-300" /> PREDICTED
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-ember-500" /> ACTUAL
              </span>
            </div>
          </div>

          {/* Step-Plot Chart Container */}
          {isEmpty ? (
            <div className="py-20 text-center border border-sky-800/40 bg-sky-950/40 font-mono text-xs text-sky-400">
              ACCURACY HISTORY IS ACQUIRING INITIAL PREDICTION TRACKS...
            </div>
          ) : (
            <div className="p-6 border border-sky-800/40 bg-sky-950/60 overflow-x-auto shadow-2xl">
              <svg className="w-full min-w-[650px] h-[340px]" viewBox="0 0 750 320">
                {/* Horizontal Gridlines (Kp 0 to 9) */}
                {[0, 2, 4, 6, 8, 9].map((kp) => {
                  const y = 40 + (320 - 80) - (kp / 9) * (320 - 80);
                  return (
                    <g key={kp}>
                      <line
                        x1="40"
                        y1={y}
                        x2="710"
                        y2={y}
                        stroke="#3E4A4A"
                        strokeWidth="0.5"
                        strokeDasharray="2 2"
                        opacity="0.4"
                      />
                      <text
                        x="32"
                        y={y + 3}
                        fill="#8B9898"
                        fontSize="10"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        Kp {kp}
                      </text>
                    </g>
                  );
                })}

                {/* Divergence fill area (15% opacity where predicted != actual) */}
                {chart.divergencePath && (
                  <path d={chart.divergencePath} fill="#C84B31" opacity="0.15" />
                )}

                {/* Predicted Kp stepAfter line (brass-500) */}
                {chart.predictedPath && (
                  <path d={chart.predictedPath} fill="none" stroke="#C9B187" strokeWidth="2.5" />
                )}

                {/* Actual Kp stepAfter line (ember-600) */}
                {chart.actualPath && (
                  <path
                    d={chart.actualPath}
                    fill="none"
                    stroke="#E0614C"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                )}

                {/* Data points */}
                {chart.points.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.predY} r="3" fill="#C9B187" />
                    <circle cx={pt.x} cy={pt.actY} r="3" fill="#E0614C" />
                  </g>
                ))}
              </svg>

              <div className="flex justify-between items-center text-[10px] font-mono text-sky-500 pt-2 border-t border-sky-800/40">
                <span>
                  START:{' '}
                  {series.length > 0 ? new Date(series[0]!.targetTime).toLocaleDateString() : '—'}
                </span>
                <span>
                  END:{' '}
                  {series.length > 0
                    ? new Date(series[series.length - 1]!.targetTime).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
