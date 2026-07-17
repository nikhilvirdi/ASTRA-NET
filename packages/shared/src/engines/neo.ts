import { LD_KM } from '../constants.js';

/** FORMULAS.md §10 — diameter from absolute magnitude H, assumed albedo 0.14. */
const NEO_ALBEDO = 0.14;

export function neoDiameterKm(absoluteMagnitudeH: number): number {
  return (1329 / Math.sqrt(NEO_ALBEDO)) * 10 ** (-0.2 * absoluteMagnitudeH);
}

/** FORMULAS.md §10 — miss distance in lunar distances. */
export function missDistanceInLunarDistances(missDistanceKm: number): number {
  return missDistanceKm / LD_KM;
}
