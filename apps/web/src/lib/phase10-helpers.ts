import type { AccuracyPointData } from './api';

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
