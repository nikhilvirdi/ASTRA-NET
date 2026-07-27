/**
 * Best-Spot-Tonight pure helper functions extracted for unit testing.
 * DESIGN_SPEC.md §12
 */

/**
 * Returns brass-tone hex color for a given Bortle class (1=darkest, 9=brightest).
 * DESIGN_SPEC.md §12: "the light-pollution grid is rendered as a continuous luminance field in brass tones."
 */
export function getBortleLuminanceColor(bortleClass: number): string {
  switch (bortleClass) {
    case 1:
      return '#111818'; // Deep night sky-900 (truly dark)
    case 2:
      return '#1C2424'; // sky-800
    case 3:
      return '#3E4A4A'; // sky-600
    case 4:
      return '#6B5A3C'; // brass-700
    case 5:
      return '#8B9898'; // sky-400
    case 6:
      return '#9A8258'; // brass-500
    case 7:
      return '#B09460';
    case 8:
      return '#C9B187'; // brass-300
    case 9:
    default:
      return '#EEF1F1'; // sky-100 (luminous light dome)
  }
}

/** Format compass direction and distance string, e.g. "NE 25 km". */
export function formatCompassDistance(site: {
  travel: { compass: string | null; distanceKm: number };
}): string {
  const compass = site.travel.compass ?? '';
  const distance = `${site.travel.distanceKm.toFixed(0)} km`;
  return compass ? `${compass} ${distance}` : distance;
}

/** Formats Google Maps directions URL using destination lat/lon coordinates. */
export function getDirectionsUrl(site: { latDeg: number; lonDeg: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${site.latDeg},${site.lonDeg}`;
}

/**
 * Converts a [0,1] factor multiplier into a discrete count of filled vs unfilled blocks (default 8).
 */
export function calculateFactorTicks(
  factor: number | null,
  segments = 8,
): { filled: number; unfilled: number } {
  if (factor === null || isNaN(factor)) return { filled: 0, unfilled: segments };
  const clamped = Math.max(0, Math.min(1, factor));
  const filled = Math.round(clamped * segments);
  return { filled, unfilled: segments - filled };
}
