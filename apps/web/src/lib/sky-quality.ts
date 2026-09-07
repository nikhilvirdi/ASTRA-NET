/**
 * Sky Quality (light pollution) presentation helpers for Home's Sky Anchor card.
 *
 * Translates Bortle class 1-9 (NASA Black Marble luma-approximation)
 * into standard human-readable descriptions.
 */

export const BORTLE_DESCRIPTIONS: Record<number, string> = {
  1: 'pristine dark sky',
  2: 'truly dark sky',
  3: 'rural sky',
  4: 'rural/suburban transition',
  5: 'suburban sky',
  6: 'bright suburban sky',
  7: 'suburban/urban transition',
  8: 'city sky',
  9: 'inner-city sky',
};

/**
 * Formats a Bortle scale rating (1-9) into a human-readable status phrase.
 * Returns null if the rating is unavailable, null, undefined, or out of range.
 */
export function formatBortleScale(bortle: number | null | undefined): string | null {
  if (bortle == null || Number.isNaN(bortle)) return null;
  const rounded = Math.round(bortle);
  const desc = BORTLE_DESCRIPTIONS[rounded];
  if (!desc) return null;
  return `Bortle ${rounded} — ${desc}`;
}
