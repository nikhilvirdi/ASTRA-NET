import React from 'react';
import type { BestSpotSite } from '@/lib/api';
import { calculateFactorTicks } from '@/lib/best-spot-helpers';

export { calculateFactorTicks };

/**
 * Renders the 8-block tick bar matching DESIGN_SPEC.md §12 & ConfidenceTicks grammar.
 */
export function RenderTickBar({
  factor,
  colorClass = 'text-brass-300',
}: {
  factor: number | null;
  colorClass?: string;
}): React.ReactElement {
  const { filled, unfilled } = calculateFactorTicks(factor, 8);
  const filledBlocks = '▮'.repeat(filled);
  const unfilledBlocks = '▯'.repeat(unfilled);

  return (
    <span className="font-mono text-xs tracking-tight">
      <span className={colorClass}>{filledBlocks}</span>
      <span className="text-sky-800">{unfilledBlocks}</span>
    </span>
  );
}

interface ScoreBreakdownProps {
  site: BestSpotSite;
  clarityAvailable: boolean;
}

/**
 * Three-bar score breakdown (clarity, darkness, travel) matching DESIGN_SPEC.md §12.
 */
export function ScoreBreakdown({
  site,
  clarityAvailable,
}: ScoreBreakdownProps): React.ReactElement {
  const { clarity, darkness, travel, aurora } = site;

  return (
    <div className="flex flex-col gap-2 font-mono text-xs text-sky-200 bg-sky-950/60 p-3 border border-sky-800/40">
      {/* 1. CLARITY BAR */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <span className="w-16 uppercase text-caption text-sky-400 font-sans shrink-0">
            CLARITY
          </span>
          {clarityAvailable && clarity.available ? (
            <RenderTickBar factor={clarity.factor} colorClass="text-brass-300" />
          ) : (
            <span className="text-sky-400 tracking-tight">▯▯▯▯▯▯▯▯</span>
          )}
        </div>
        <span className="text-caption text-sky-300">
          {clarityAvailable && clarity.available && clarity.cloudCoverPercent !== null
            ? `${clarity.cloudCoverPercent.toFixed(0)}% CLOUD`
            : 'CLOUD DATA UNAVAILABLE'}
        </span>
      </div>

      {/* 2. DARKNESS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <span className="w-16 uppercase text-caption text-sky-400 font-sans shrink-0">
            DARKNESS
          </span>
          <RenderTickBar factor={darkness.factor} colorClass="text-brass-300" />
        </div>
        <span className="text-caption text-brass-300">BORTLE {darkness.bortleClass}</span>
      </div>

      {/* 3. TRAVEL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <span className="w-16 uppercase text-caption text-sky-400 font-sans shrink-0">
            TRAVEL
          </span>
          <RenderTickBar factor={travel.factor} colorClass="text-sky-200" />
        </div>
        <span className="text-caption text-sky-300">{travel.distanceKm.toFixed(0)} km</span>
      </div>

      {/* 4. OPTIONAL AURORA BAR (if event=aurora active) */}
      {aurora && (
        <div className="flex flex-wrap items-center justify-between pt-1 border-t border-sky-800/40 text-emerald-400 gap-x-3 gap-y-1">
          <div className="flex items-center gap-3">
            <span className="w-16 uppercase text-caption text-emerald-400 font-sans shrink-0">
              AURORA
            </span>
            <RenderTickBar factor={aurora.factor} colorClass="text-emerald-400" />
          </div>
          <span className="text-caption text-emerald-300">
            {aurora.visible ? `VISIBLE · Kp ${aurora.kp}` : `SUB-HORIZON · Kp ${aurora.kp}`}
          </span>
        </div>
      )}
    </div>
  );
}
