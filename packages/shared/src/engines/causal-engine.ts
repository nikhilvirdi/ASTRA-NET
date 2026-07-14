import { clamp } from '../math-utils';
import {
  auroralOvalBoundaryDeg,
  auroraVisibility,
  geomagneticLatitudeDeg,
  type AuroraVisibility,
} from './aurora';

/** FORMULAS.md §8 — lead-time factor: closer arrivals are more confident. */
const LEAD_TAU_HOURS = 24;

export function leadTimeFactor(tRemainingHours: number): number {
  return 0.3 + 0.7 * Math.exp(-tRemainingHours / LEAD_TAU_HOURS);
}

/** FORMULAS.md §8 — source-agreement factor: penalizes Kp_cme/Kp_swpc mismatch. */
const AGREEMENT_SIGMA = 2;

export function sourceAgreementFactor(kpCme: number, kpSwpc: number): number {
  return Math.exp(-Math.abs(kpCme - kpSwpc) / AGREEMENT_SIGMA);
}

/** FORMULAS.md §8 / §9 — history factor: Beta posterior mean, +2/+4 neutral prior. */
export function historyFactor(hits: number, trials: number): number {
  return (hits + 2) / (trials + 4);
}

/** FORMULAS.md §8 — CME-speed to Kp heuristic, used only for the agreement factor. */
export function cmeSpeedToKp(v0KmS: number): number {
  const raw = 1.5 + 2.3 * Math.log10(v0KmS / 400);
  return clamp(Math.round(raw), 0, 9);
}

export type ConfidenceBand = 'high' | 'moderate' | 'low';

/** FORMULAS.md §8 — confidence bands. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence > 0.66) return 'high';
  if (confidence >= 0.33) return 'moderate';
  return 'low';
}

/** FORMULAS.md §8 — C = f_lead * f_agree * f_hist. */
export function combinedConfidence(fLead: number, fAgree: number, fHist: number): number {
  return fLead * fAgree * fHist;
}

export interface CmeEvent {
  v0KmS: number;
  predictedArrivalTime: Date;
}

export interface KpForecastContext {
  kpPredicted: number;
  history: { hits: number; trials: number };
}

export interface AuroraConfidencePrediction {
  predictedKp: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  factors: { lead: number; agreement: number; history: number };
  kpCme: number;
  leadHours: number;
}

/**
 * FORMULAS.md §8 — the Causal Engine's confidence composition: lead-time x
 * source-agreement x history, all multiplicative. This is the single most
 * important function in the codebase (CLAUDE.md); every factor here is
 * independently unit-tested above, and this function only composes them
 * with no additional math of its own.
 */
export function predictAuroraConfidence(
  event: CmeEvent,
  forecast: KpForecastContext,
  now: Date,
): AuroraConfidencePrediction {
  const leadHours = (event.predictedArrivalTime.getTime() - now.getTime()) / 3_600_000;
  const kpCme = cmeSpeedToKp(event.v0KmS);

  const fLead = leadTimeFactor(leadHours);
  const fAgree = sourceAgreementFactor(kpCme, forecast.kpPredicted);
  const fHist = historyFactor(forecast.history.hits, forecast.history.trials);
  const confidence = combinedConfidence(fLead, fAgree, fHist);

  return {
    predictedKp: forecast.kpPredicted,
    confidence,
    confidenceBand: confidenceBand(confidence),
    factors: { lead: fLead, agreement: fAgree, history: fHist },
    kpCme,
    leadHours,
  };
}

export interface AuroraPredictionForObserver extends AuroraConfidencePrediction {
  geomagneticLatitudeDeg: number;
  auroraOvalBoundaryDeg: number;
  visible: boolean;
  visibilityStrength: number;
}

/**
 * Composes the §8 confidence prediction with the §7 visibility check for a
 * specific observer. NOTE: this is the "(events, forecast, userLat, now) ->
 * prediction" function described in the task brief, with `observerLonDeg`
 * added — §7's geomagnetic-latitude transform is a 2D dipole rotation and
 * requires longitude as well as latitude; a lat-only signature can't
 * compute it. Logged in DECISIONS.md.
 */
export function predictAuroraForObserver(
  event: CmeEvent,
  forecast: KpForecastContext,
  observerLatDeg: number,
  observerLonDeg: number,
  now: Date,
): AuroraPredictionForObserver {
  const base = predictAuroraConfidence(event, forecast, now);
  const visibility: AuroraVisibility = auroraVisibility(
    observerLatDeg,
    observerLonDeg,
    forecast.kpPredicted,
  );

  return {
    ...base,
    geomagneticLatitudeDeg: geomagneticLatitudeDeg(observerLatDeg, observerLonDeg),
    auroraOvalBoundaryDeg: auroralOvalBoundaryDeg(forecast.kpPredicted),
    visible: visibility.visible,
    visibilityStrength: visibility.strength,
  };
}
