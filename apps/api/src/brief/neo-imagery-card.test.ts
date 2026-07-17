import { describe, expect, it } from 'vitest';
import { buildNeoImageryCard } from './neo-imagery-card';
import type { GibsLayerOptions } from '../clients/gibs/index.js';
import type { NasaNeowsData, NeowsObject } from '../clients/nasa/index.js';
import type { SourceState } from '../poller/store.js';

const FETCHED_AT = '2026-07-17T12:00:00.000Z';

function neowsState(data: NasaNeowsData | null, healthy = true): SourceState<NasaNeowsData> {
  return { data, fetchedAt: FETCHED_AT, healthy };
}

function gibsState(data: GibsLayerOptions | null, healthy = true): SourceState<GibsLayerOptions> {
  return { data, fetchedAt: FETCHED_AT, healthy };
}

function neoObject(
  id: string,
  missDistanceKm: number,
  hMagnitude: number | null = 20,
): NeowsObject {
  return {
    id,
    name: `(NEO ${id})`,
    nasaJplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${id}`,
    absoluteMagnitudeH: hMagnitude,
    estimatedDiameterMinKm: 0.1,
    estimatedDiameterMaxKm: 0.3,
    isPotentiallyHazardous: false,
    isSentryObject: false,
    closeApproaches: [
      {
        date: '2026-07-18',
        epochDate: 1_800_000_000_000,
        velocityKmS: 12.3,
        missDistanceKm,
        orbitingBody: 'Earth',
      },
    ],
  };
}

describe('buildNeoImageryCard', () => {
  it('picks the closest approach across multiple objects', () => {
    const far = neoObject('far', 5_000_000);
    const near = neoObject('near', 500_000);

    const card = buildNeoImageryCard(
      neowsState({ elementCount: 2, objects: [far, near], fetchedAt: FETCHED_AT }),
      gibsState(null),
    );

    expect(card.neo?.id).toBe('near');
    expect(card.neo?.missDistanceKm).toBe(500_000);
    expect(card.neo?.missDistanceLunarDistances).toBeCloseTo(500_000 / 384_400, 5);
  });

  it('computes diameter from absolute magnitude H per FORMULAS.md §10', () => {
    const object = neoObject('h20', 1_000_000, 20);

    const card = buildNeoImageryCard(
      neowsState({ elementCount: 1, objects: [object], fetchedAt: FETCHED_AT }),
      gibsState(null),
    );

    // D_km = (1329 / sqrt(0.14)) * 10^(-0.2*20) — hand-computed reference value.
    expect(card.neo?.diameterKm).toBeCloseTo(0.355, 2);
  });

  it('leaves diameter null when NeoWs did not supply an absolute magnitude', () => {
    const object = neoObject('noh', 1_000_000, null);

    const card = buildNeoImageryCard(
      neowsState({ elementCount: 1, objects: [object], fetchedAt: FETCHED_AT }),
      gibsState(null),
    );

    expect(card.neo?.diameterKm).toBeNull();
  });

  it('returns imagery independently when NeoWs is down', () => {
    const gibs: GibsLayerOptions = {
      layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
      date: '2026-07-16',
    };

    const card = buildNeoImageryCard(neowsState(null, false), gibsState(gibs));

    expect(card.neo).toBeNull();
    expect(card.imagery).not.toBeNull();
    expect(card.imagery?.layer).toBe('VIIRS_SNPP_CorrectedReflectance_TrueColor');
    expect(card.imagery?.tileUrl).toContain('VIIRS_SNPP_CorrectedReflectance_TrueColor');
  });

  it('returns neo independently when GIBS is down', () => {
    const object = neoObject('solo', 200_000);

    const card = buildNeoImageryCard(
      neowsState({ elementCount: 1, objects: [object], fetchedAt: FETCHED_AT }),
      gibsState(null, false),
    );

    expect(card.neo).not.toBeNull();
    expect(card.imagery).toBeNull();
  });

  it('returns both null when nothing resolves', () => {
    const card = buildNeoImageryCard(neowsState(null, false), gibsState(null, false));
    expect(card.neo).toBeNull();
    expect(card.imagery).toBeNull();
  });
});
