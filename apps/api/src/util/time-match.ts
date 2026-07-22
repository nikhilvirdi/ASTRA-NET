/**
 * Picks the entry whose `timeTag` is closest to `target` — shared by the
 * aurora forecast lookup (`brief/space-weather-card.ts`'s
 * `selectNearestForecastEntry`) and the daily accuracy job's
 * observed-Kp lookup (`predictions/accuracy.ts`), both of which need the
 * identical "nearest 3-hour-cadence SWPC entry to a given instant"
 * selection over otherwise differently-shaped entry types.
 */
export function selectNearestByTimeTag<T extends { timeTag: string }>(
  entries: T[],
  target: Date,
): T | null {
  return entries.reduce<T | null>((closest, entry) => {
    if (closest === null) return entry;
    const entryDiff = Math.abs(new Date(entry.timeTag).getTime() - target.getTime());
    const closestDiff = Math.abs(new Date(closest.timeTag).getTime() - target.getTime());
    return entryDiff < closestDiff ? entry : closest;
  }, null);
}
