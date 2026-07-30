import type { AccuracyPointData } from './api';
import type { SkyLogEntryData } from '@/store';

/**
 * Calculates header summary statistics for the Personal Sky Log (DESIGN_SPEC.md §13).
 */
export function calculateLogStats(entries: SkyLogEntryData[]): {
  totalSightings: number;
  streakDays: number;
  lastAurora: string | null;
} {
  const totalSightings = entries.length;

  // Find last aurora entry
  const auroraEntries = entries.filter((e) => e.eventType.toLowerCase().includes('aurora'));
  const lastAurora = auroraEntries.length > 0 ? auroraEntries[0]!.timestamp : null;

  // Calculate daily streak
  if (entries.length === 0) {
    return { totalSightings: 0, streakDays: 0, lastAurora: null };
  }

  const uniqueDays = new Set(entries.map((e) => new Date(e.timestamp).toISOString().split('T')[0]));
  const sortedDays = Array.from(uniqueDays).sort().reverse();

  let streakDays = 0;
  const today = new Date().toISOString().split('T')[0]!;
  let checkDate = new Date(sortedDays[0]!);

  // If latest entry is today or yesterday, count backwards
  const latestDateStr = sortedDays[0]!;
  const daysDiff = Math.floor(
    (new Date(today).getTime() - new Date(latestDateStr).getTime()) / (1000 * 3600 * 24),
  );

  if (daysDiff <= 1) {
    for (const dayStr of sortedDays) {
      if (!dayStr) continue;
      const currentDay = new Date(dayStr);
      const diff = Math.floor((checkDate.getTime() - currentDay.getTime()) / (1000 * 3600 * 24));
      if (diff > 1 && streakDays > 0) break;
      streakDays++;
      checkDate = currentDay;
    }
  }

  return { totalSightings, streakDays, lastAurora };
}

/**
 * Groups sky log entries by month string, e.g. "JULY 2026".
 */
export function groupEntriesByMonth(entries: SkyLogEntryData[]): Map<string, SkyLogEntryData[]> {
  const grouped = new Map<string, SkyLogEntryData[]>();

  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const monthYear = d
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase();

    if (!grouped.has(monthYear)) {
      grouped.set(monthYear, []);
    }
    grouped.get(monthYear)!.push(entry);
  }

  return grouped;
}

/**
 * Formats event type raw identifiers to human readable display labels.
 */
export function formatEventTypeLabel(eventType: string): string {
  switch (eventType.toLowerCase()) {
    case 'iss_pass':
    case 'iss':
      return 'ISS VISIBLE PASS';
    case 'aurora':
    case 'aurora_borealis':
      return 'AURORA BOREALIS';
    case 'meteor_shower':
    case 'meteor':
      return 'METEOR SHOWER';
    case 'neo_approach':
    case 'neo':
      return 'NEAR-EARTH OBJECT';
    case 'stargazing':
    default:
      return eventType.toUpperCase().replace(/_/g, ' ');
  }
}

/**
 * Generates discrete step-plot SVG paths for predicted Kp vs actual Kp (DESIGN_SPEC.md §14).
 * Step plot (type="stepAfter") preserves discrete Kp index steps [0..9].
 */
export function generateStepPlotPaths(
  series: AccuracyPointData[],
  width = 750,
  height = 320,
  padding = 40,
): {
  predictedPath: string;
  actualPath: string;
  divergencePath: string;
  points: Array<{ x: number; predY: number; actY: number; point: AccuracyPointData }>;
} {
  if (series.length === 0) {
    return { predictedPath: '', actualPath: '', divergencePath: '', points: [] };
  }

  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  // Map index to X and Kp value [0..9] to Y
  const getX = (index: number): number => {
    if (series.length === 1) return padding + plotWidth / 2;
    return padding + (index / (series.length - 1)) * plotWidth;
  };

  const getY = (kp: number): number => {
    const clampedKp = Math.max(0, Math.min(9, kp));
    return padding + plotHeight - (clampedKp / 9) * plotHeight;
  };

  const points = series.map((p, i) => ({
    x: getX(i),
    predY: getY(p.predictedKp),
    actY: getY(p.actualKp),
    point: p,
  }));

  // Build stepAfter paths (horizontal then vertical)
  let predD = `M ${points[0]!.x} ${points[0]!.predY}`;
  let actD = `M ${points[0]!.x} ${points[0]!.actY}`;

  for (let i = 1; i < points.length; i++) {
    const curr = points[i]!;

    // StepAfter: H to curr.x, then V to curr.y
    predD += ` H ${curr.x} V ${curr.predY}`;
    actD += ` H ${curr.x} V ${curr.actY}`;
  }

  // Build divergence polygon area between predicted and actual step curves
  let divD = `M ${points[0]!.x} ${points[0]!.predY}`;
  for (let i = 1; i < points.length; i++) {
    const curr = points[i]!;
    divD += ` H ${curr.x} V ${curr.predY}`;
  }
  // Trace back along actual curve in reverse
  divD += ` L ${points[points.length - 1]!.x} ${points[points.length - 1]!.actY}`;
  for (let i = points.length - 2; i >= 0; i--) {
    const curr = points[i]!;
    divD += ` H ${curr.x} V ${curr.actY}`;
  }
  divD += ' Z';

  return {
    predictedPath: predD,
    actualPath: actD,
    divergencePath: divD,
    points,
  };
}
