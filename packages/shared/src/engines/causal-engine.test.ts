import { describe, expect, it } from 'vitest';
import {
  cmeSpeedToKp,
  combinedConfidence,
  confidenceBand,
  historyFactor,
  leadTimeFactor,
  predictAuroraConfidence,
  predictAuroraForObserver,
  sourceAgreementFactor,
} from './causal-engine';

describe('leadTimeFactor', () => {
  it('is 1.0 at zero remaining time (arrival is now)', () => {
    expect(leadTimeFactor(0)).toBeCloseTo(1.0, 10);
  });

  it('lead_factor_approaches_0.3_at_long_horizon', () => {
    // As t_remaining -> infinity, exp(-t/tau) -> 0, so f_lead -> 0.3 (the floor).
    expect(leadTimeFactor(1000)).toBeCloseTo(0.3, 6);
  });

  it('decreases monotonically as remaining time grows', () => {
    expect(leadTimeFactor(48)).toBeLessThan(leadTimeFactor(24));
    expect(leadTimeFactor(24)).toBeLessThan(leadTimeFactor(0));
  });
});

describe('sourceAgreementFactor', () => {
  it('is 1.0 for perfect Kp agreement', () => {
    expect(sourceAgreementFactor(5, 5)).toBeCloseTo(1.0, 10);
  });

  it('agreement_factor_penalizes_kp_mismatch', () => {
    const smallMismatch = sourceAgreementFactor(5, 4); // |diff| = 1
    const largeMismatch = sourceAgreementFactor(5, 0); // |diff| = 5
    expect(largeMismatch).toBeLessThan(smallMismatch);
    expect(smallMismatch).toBeLessThan(1.0);
  });
});

describe('historyFactor', () => {
  it('history_factor_neutral_with_no_trials', () => {
    // Beta prior: (0+2)/(0+4) = 0.5 -- an honest, neutral prior, not 0 or 1.
    expect(historyFactor(0, 0)).toBeCloseTo(0.5, 10);
  });

  it('trends toward the observed hit rate as trials accumulate', () => {
    expect(historyFactor(90, 100)).toBeGreaterThan(historyFactor(0, 0));
    expect(historyFactor(10, 100)).toBeLessThan(historyFactor(0, 0));
  });
});

describe('cmeSpeedToKp', () => {
  it('maps ambient-speed CMEs (v0 == 400) to a low Kp', () => {
    expect(cmeSpeedToKp(400)).toBe(2); // round(1.5 + 2.3*log10(1)) = round(1.5) = 2
  });

  it('clamps to 9 for an extreme speed', () => {
    expect(cmeSpeedToKp(1_000_000)).toBe(9);
  });

  it('clamps to 0 for an implausibly slow speed', () => {
    expect(cmeSpeedToKp(1)).toBe(0);
  });
});

describe('confidenceBand', () => {
  it('is "high" strictly above 0.66', () => {
    expect(confidenceBand(0.67)).toBe('high');
  });

  it('is "moderate" at the 0.66 boundary (inclusive upper bound of moderate)', () => {
    expect(confidenceBand(0.66)).toBe('moderate');
  });

  it('is "moderate" at the 0.33 boundary (inclusive lower bound of moderate)', () => {
    expect(confidenceBand(0.33)).toBe('moderate');
  });

  it('is "low" strictly below 0.33', () => {
    expect(confidenceBand(0.32)).toBe('low');
  });
});

describe('combinedConfidence', () => {
  it('multiplies the three factors together', () => {
    expect(combinedConfidence(0.5, 0.5, 0.5)).toBeCloseTo(0.125, 10);
  });
});

describe('predictAuroraConfidence', () => {
  it('composes lead/agreement/history into a full prediction', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const event = {
      v0KmS: 400, // -> kpCme = 2
      predictedArrivalTime: new Date('2026-01-02T00:00:00Z'), // 24h out
    };
    const forecast = {
      kpPredicted: 2, // perfect agreement with kpCme
      history: { hits: 0, trials: 0 }, // neutral prior
    };

    const prediction = predictAuroraConfidence(event, forecast, now);

    expect(prediction.leadHours).toBeCloseTo(24, 6);
    expect(prediction.kpCme).toBe(2);
    expect(prediction.factors.lead).toBeCloseTo(leadTimeFactor(24), 10);
    expect(prediction.factors.agreement).toBeCloseTo(1.0, 10);
    expect(prediction.factors.history).toBeCloseTo(0.5, 10);
    expect(prediction.confidence).toBeCloseTo(leadTimeFactor(24) * 1.0 * 0.5, 10);
    expect(prediction.confidenceBand).toBe(confidenceBand(prediction.confidence));
    expect(prediction.predictedKp).toBe(2);
  });
});

describe('predictAuroraForObserver', () => {
  it('folds in section-7 visibility for a specific observer location', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const event = { v0KmS: 800, predictedArrivalTime: new Date('2026-01-01T12:00:00Z') };
    const forecast = { kpPredicted: 9, history: { hits: 5, trials: 10 } };

    const prediction = predictAuroraForObserver(event, forecast, 45, -72.8, now);

    // The visibility half of the result must match calling the §7 engine directly.
    expect(prediction.visible).toBe(true);
    expect(prediction.geomagneticLatitudeDeg).toBeCloseTo(54.3, 0);
    expect(prediction.auroraOvalBoundaryDeg).toBe(48);

    // The confidence half must still match the plain §8 composite.
    const base = predictAuroraConfidence(event, forecast, now);
    expect(prediction.confidence).toBeCloseTo(base.confidence, 10);
  });
});
