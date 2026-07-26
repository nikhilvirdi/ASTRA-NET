/**
 * satellite.js v5.0.0 exports `radiansToDegrees`, `radiansLat`, and
 * `radiansLong` at runtime (lib/transforms.js) but its bundled
 * types/index.d.ts omits all three — an upstream typing gap, not a missing
 * dependency (confirmed against the compiled lib; see DECISIONS.md).
 * Declared here via module augmentation so callers keep real type safety
 * instead of an implicit `any`. Extend only when another missing export is
 * actually needed.
 */
declare module 'satellite.js' {
  export function radiansToDegrees(radians: number): number;
  export function radiansLat(radians: number): number;
  export function radiansLong(radians: number): number;
}
