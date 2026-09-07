import React from 'react';
import { formatBortleScale } from '@/lib/sky-quality';

export interface SkyQualityStatusProps {
  bortle: number | null | undefined;
  className?: string;
}

/**
 * Sky Quality status line rendered in Home's Sky Anchor section,
 * alongside twilight phase and darkness status.
 *
 * Reuses the existing status line styling (type-body text-sky-200 text-sm)
 * and omits the line entirely when Bortle data is unavailable or null.
 */
export function SkyQualityStatus({
  bortle,
  className = 'type-body text-sky-200 text-sm mt-1',
}: SkyQualityStatusProps): React.ReactElement | null {
  const text = formatBortleScale(bortle);
  if (!text) return null;

  return (
    <p className={className} data-testid="sky-quality-status">
      {text}
    </p>
  );
}
