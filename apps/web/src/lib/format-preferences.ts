/**
 * Shared formatting utilities respecting user preferences (Time Format & Unit System).
 * DESIGN_SPEC.md & settings preference support.
 */

export type TimeFormat = '12h' | '24h';
export type UnitSystem = 'metric' | 'imperial';

export const KM_TO_MI = 0.621371;
export const M_TO_FT = 3.28084;

/**
 * Format time according to user preference.
 * - '24h': "14:30"
 * - '12h': "2:30 PM"
 */
export function formatTime(
  dateOrUtc: Date | string | number | null | undefined,
  timeFormat: TimeFormat = '24h',
): string {
  if (dateOrUtc === null || dateOrUtc === undefined) return '—';
  const d =
    typeof dateOrUtc === 'object' && dateOrUtc instanceof Date ? dateOrUtc : new Date(dateOrUtc);

  if (isNaN(d.getTime())) return '—';

  if (timeFormat === '12h') {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format distance in kilometers or miles.
 * e.g. formatDistance(120, 'metric') -> "120 km"
 *      formatDistance(120, 'imperial') -> "75 mi"
 */
export function formatDistance(km: number, units: UnitSystem = 'metric', decimals = 0): string {
  if (units === 'imperial') {
    const mi = km * KM_TO_MI;
    const val = decimals > 0 ? mi.toFixed(decimals) : Math.round(mi).toString();
    return `${val} mi`;
  }
  const val = decimals > 0 ? km.toFixed(decimals) : Math.round(km).toString();
  return `${val} km`;
}

/**
 * Format large distances (in millions of km or miles).
 * e.g. formatMillionsDistance(4_120_000, 'metric') -> "4.12M km"
 *      formatMillionsDistance(4_120_000, 'imperial') -> "2.56M mi"
 */
export function formatMillionsDistance(
  km: number,
  units: UnitSystem = 'metric',
  decimals = 2,
): string {
  if (units === 'imperial') {
    const mi = km * KM_TO_MI;
    return `${(mi / 1_000_000).toFixed(decimals)}M mi`;
  }
  return `${(km / 1_000_000).toFixed(decimals)}M km`;
}

/**
 * Format speed according to unit system.
 * Handles 'km/s' (e.g. solar wind / asteroid velocity) and 'km/h'.
 * - formatSpeed(333, 'metric', 'km/s') -> "333 km/s"
 * - formatSpeed(333, 'imperial', 'km/s') -> "207 mi/s"
 * - formatSpeed(100, 'metric', 'km/h') -> "100 km/h"
 * - formatSpeed(100, 'imperial', 'km/h') -> "62 mph"
 */
export function formatSpeed(
  value: number,
  units: UnitSystem = 'metric',
  inputUnit: 'km/h' | 'km/s' = 'km/s',
  decimals?: number,
): string {
  if (inputUnit === 'km/s') {
    if (units === 'imperial') {
      const miPerSec = value * KM_TO_MI;
      const formatted =
        decimals !== undefined ? miPerSec.toFixed(decimals) : Math.round(miPerSec).toString();
      return `${formatted} mi/s`;
    }
    const formatted =
      decimals !== undefined ? value.toFixed(decimals) : Math.round(value).toString();
    return `${formatted} km/s`;
  }

  if (units === 'imperial') {
    const mph = value * KM_TO_MI;
    const formatted = decimals !== undefined ? mph.toFixed(decimals) : Math.round(mph).toString();
    return `${formatted} mph`;
  }
  const formatted = decimals !== undefined ? value.toFixed(decimals) : Math.round(value).toString();
  return `${formatted} km/h`;
}

/**
 * Format length in meters or feet.
 * e.g. formatLength(300, 'metric') -> "300m"
 *      formatLength(300, 'imperial') -> "984ft"
 */
export function formatLength(meters: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const ft = Math.round(meters * M_TO_FT);
    return `${ft.toLocaleString()}ft`;
  }
  return `${Math.round(meters)}m`;
}

/**
 * Get comparison landmark text for asteroid sizes in metric or imperial.
 */
export function getNeoComparisonLabel(meters: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const ft = Math.round(meters * M_TO_FT);
    if (ft < 164) {
      return `Blue Whale (${Math.round(30 * M_TO_FT)}ft)`;
    } else if (ft < 492) {
      return `Statue of Liberty (${Math.round(93 * M_TO_FT)}ft)`;
    } else if (ft < 1476) {
      return `Eiffel Tower (${Math.round(300 * M_TO_FT)}ft)`;
    } else if (ft < 2952) {
      return `Burj Khalifa (${Math.round(830 * M_TO_FT).toLocaleString()}ft)`;
    } else {
      const miles = ((meters / 1000) * KM_TO_MI).toFixed(1);
      return `${miles}mi Mountain Scale`;
    }
  }

  if (meters < 50) {
    return 'Blue Whale (30m)';
  } else if (meters < 150) {
    return 'Statue of Liberty (93m)';
  } else if (meters < 450) {
    return 'Eiffel Tower (300m)';
  } else if (meters < 900) {
    return 'Burj Khalifa (830m)';
  } else {
    return `${(meters / 1000).toFixed(1)}km Mountain Scale`;
  }
}
