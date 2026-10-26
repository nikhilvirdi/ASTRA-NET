import type { HorizonObject } from '@/lib/celestial-horizon-data';

export type { HorizonObject };

export interface HorizontalCoordinates {
  altitudeDeg: number;
  azimuthDeg: number;
}

export type BelowHorizonPolicy = 'dimmed' | 'hidden';

export interface CelestialHorizonProps {
  /** Array of celestial objects with real alt/az coordinates to plot */
  objects: HorizonObject[];
  /** Currently selected object ID (controlled or initial) */
  selectedObjectId?: string | null;
  /** Callback fired when an object is selected */
  onSelectObject?: (object: HorizonObject | null) => void;
  /** Observer latitude for HUD telemetry label */
  observerLatitudeDeg?: number;
  /** Observer longitude for HUD telemetry label */
  observerLongitudeDeg?: number;
  /** Policy for objects with altitudeDeg < 0. Default: "dimmed" */
  belowHorizonPolicy?: BelowHorizonPolicy;
  /** Allow clicking on dome surface to probe coordinates. Default: true */
  enableDomeInspection?: boolean;
  /** Height of the visualizer container. Default: 500 */
  height?: number | string;
  /** Optional container class name */
  className?: string;
}
