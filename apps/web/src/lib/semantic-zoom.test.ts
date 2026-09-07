import { describe, expect, it } from 'vitest';
import {
  aggregateSkyObjects,
  angularSeparationDeg,
  drillFovDeg,
  fovToZoomLevel,
  HORIZON_REFRACTION_DEG,
  isAboveHorizon,
  MAX_CLICKABLE_OBJECTS,
  mergeRadiusDeg,
  sphericalCentroid,
  ZOOM_FOV_MIDPOINTS_DEG,
  type SkyObjectInput,
} from './semantic-zoom';

describe('isAboveHorizon', () => {
  it('is true well above the horizon', () => {
    expect(isAboveHorizon(45)).toBe(true);
  });

  it('is true at the true horizon (0deg) and within the refraction margin below it', () => {
    expect(isAboveHorizon(0)).toBe(true);
    expect(isAboveHorizon(-HORIZON_REFRACTION_DEG / 2)).toBe(true);
    expect(isAboveHorizon(-HORIZON_REFRACTION_DEG)).toBe(true);
  });

  it('is false once genuinely below the horizon, past the refraction margin', () => {
    expect(isAboveHorizon(-HORIZON_REFRACTION_DEG - 0.01)).toBe(false);
    expect(isAboveHorizon(-36.5)).toBe(false);
  });
});

function sat(id: string, azimuthDeg: number, altitudeDeg: number, pinned = false): SkyObjectInput {
  return { id, kind: 'satellite', azimuthDeg, altitudeDeg, pinned };
}

/** Today's real anchor roster: pinned ISS + Jupiter + Sun. */
function anchors(): SkyObjectInput[] {
  return [
    sat('iss', 120, 40, true),
    { id: 'jupiter', kind: 'planet', azimuthDeg: 250, altitudeDeg: 30 },
    { id: 'sun', kind: 'sun', azimuthDeg: 180, altitudeDeg: -20 },
  ];
}

/** Deterministic scattered satellite population (mulberry32). */
function scatteredSats(n: number, seed: number): SkyObjectInput[] {
  let a = seed >>> 0;
  const rand = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, (_, i) =>
    sat(`sat-${String(i).padStart(3, '0')}`, rand() * 360, (Math.asin(rand()) * 180) / Math.PI),
  );
}

function clickables(result: ReturnType<typeof aggregateSkyObjects>): number {
  return result.renderables.length;
}

describe('fovToZoomLevel', () => {
  it('maps the FOV range onto the three bands with edges at 45 and 70', () => {
    expect(fovToZoomLevel(30)).toBe(0);
    expect(fovToZoomLevel(44.99)).toBe(0);
    expect(fovToZoomLevel(45)).toBe(1);
    expect(fovToZoomLevel(69.99)).toBe(1);
    expect(fovToZoomLevel(70)).toBe(2);
    expect(fovToZoomLevel(90)).toBe(2);
  });
});

describe('drillFovDeg', () => {
  it('targets the next band in, saturating at level 0', () => {
    expect(drillFovDeg(2)).toBe(ZOOM_FOV_MIDPOINTS_DEG[1]);
    expect(drillFovDeg(1)).toBe(ZOOM_FOV_MIDPOINTS_DEG[0]);
    expect(drillFovDeg(0)).toBe(ZOOM_FOV_MIDPOINTS_DEG[0]);
  });

  it('always lands inside the band it names (drilling actually changes level)', () => {
    expect(fovToZoomLevel(drillFovDeg(2))).toBe(1);
    expect(fovToZoomLevel(drillFovDeg(1))).toBe(0);
  });
});

describe('mergeRadiusDeg', () => {
  // Orphaned from aggregateSkyObjects — satellites no longer cluster at all,
  // so there is no merge radius of any kind anymore (semantic-zoom.ts's file
  // header / DECISIONS.md 2026-09-07) — but still a real, correctly-behaved
  // pure function worth its own coverage.
  it('shrinks as the camera zooms in', () => {
    expect(mergeRadiusDeg(0)).toBeLessThan(mergeRadiusDeg(1));
    expect(mergeRadiusDeg(1)).toBeLessThan(mergeRadiusDeg(2));
  });
});

describe('angularSeparationDeg', () => {
  // Also orphaned from aggregateSkyObjects (see above) — kept for its own
  // standalone coverage as a general-purpose geometry utility.
  it('is zero for identical positions', () => {
    expect(
      angularSeparationDeg(
        { azimuthDeg: 33, altitudeDeg: 21 },
        { azimuthDeg: 33, altitudeDeg: 21 },
      ),
    ).toBeCloseTo(0, 6);
  });

  it('is 90° between north and east on the horizon', () => {
    expect(
      angularSeparationDeg({ azimuthDeg: 0, altitudeDeg: 0 }, { azimuthDeg: 90, altitudeDeg: 0 }),
    ).toBeCloseTo(90, 6);
  });

  it('is 90° between the horizon and the zenith', () => {
    expect(
      angularSeparationDeg({ azimuthDeg: 0, altitudeDeg: 0 }, { azimuthDeg: 0, altitudeDeg: 90 }),
    ).toBeCloseTo(90, 6);
  });

  it('ignores azimuth at the zenith (poles are a single point)', () => {
    expect(
      angularSeparationDeg(
        { azimuthDeg: 10, altitudeDeg: 90 },
        { azimuthDeg: 200, altitudeDeg: 90 },
      ),
    ).toBeCloseTo(0, 6);
  });
});

describe('sphericalCentroid', () => {
  // Also orphaned from aggregateSkyObjects (no more cluster centroids to
  // compute) — kept for its own standalone coverage.
  it('returns the midpoint of a symmetric pair', () => {
    const c = sphericalCentroid([
      { azimuthDeg: 80, altitudeDeg: 30 },
      { azimuthDeg: 100, altitudeDeg: 30 },
    ]);
    expect(c.azimuthDeg).toBeCloseTo(90, 5);
    expect(c.altitudeDeg).toBeGreaterThan(29);
  });

  it('handles the 0°/360° azimuth wrap (does not average to due South)', () => {
    const c = sphericalCentroid([
      { azimuthDeg: 350, altitudeDeg: 20 },
      { azimuthDeg: 10, altitudeDeg: 20 },
    ]);
    expect(Math.min(c.azimuthDeg, 360 - c.azimuthDeg)).toBeCloseTo(0, 5);
  });

  it('falls back to the first member for a degenerate (antipodal) set', () => {
    const c = sphericalCentroid([
      { azimuthDeg: 0, altitudeDeg: 0 },
      { azimuthDeg: 180, altitudeDeg: 0 },
    ]);
    expect(c).toEqual({ azimuthDeg: 0, altitudeDeg: 0 });
  });
});

describe('aggregateSkyObjects — everything renders individually', () => {
  it("today's real roster (3 anchors) passes through untouched", () => {
    const result = aggregateSkyObjects(anchors());
    expect(result.regime).toBe('individual');
    expect(result.renderables).toHaveLength(3);
    expect(result.renderables.every((r) => r.kind === 'object')).toBe(true);
    expect(result.clickableCount).toBe(3);
  });

  it('widely-spaced satellites render individually', () => {
    const spaced = Array.from({ length: 7 }, (_, i) => sat(`s${i}`, i * 40, 0));
    const result = aggregateSkyObjects(spaced);
    expect(result.regime).toBe('individual');
    expect(result.renderables).toHaveLength(7);
  });

  it('satellites packed within a fraction of a degree of each other still render individually — no clustering, ever', () => {
    // This exact fixture used to merge into one cluster renderable under the
    // prior fixed-radius clustering behavior. Clustering has been removed
    // entirely: it must now produce 7 separate individual renderables.
    const packed = Array.from({ length: 7 }, (_, i) => sat(`s${i}`, 100 + i * 0.1, 0));
    const result = aggregateSkyObjects(packed);
    expect(result.regime).toBe('individual');
    expect(result.renderables).toHaveLength(7);
    expect(result.renderables.every((r) => r.kind === 'object')).toBe(true);
  });

  it('an empty scene aggregates to an empty scene', () => {
    const result = aggregateSkyObjects([]);
    expect(result.renderables).toHaveLength(0);
    expect(result.clickableCount).toBe(0);
  });
});

describe('aggregateSkyObjects — no clustering, no shell, under any population shape', () => {
  // Fixtures that specifically used to trigger clustering (tight knots) or
  // the chain-rejection path, back when satellites could merge. Confirms
  // none of that machinery is reachable anymore.

  it('a tight knot of satellites (formerly one cluster) renders as that many individuals', () => {
    const knot = [0, 1, 2, 3].map((i) => sat(`a${i}`, 60 + i * 0.1, 0));
    const result = aggregateSkyObjects([...anchors(), ...knot]);
    expect(result.regime).toBe('individual');
    expect(result.renderables.every((r) => r.kind === 'object')).toBe(true);
    expect(result.renderables).toHaveLength(anchors().length + knot.length);
  });

  it('two separate tight knots (formerly two clusters) render as that many individuals', () => {
    const knotA = [0, 1, 2, 3].map((i) => sat(`a${i}`, 60 + i * 0.1, 0));
    const knotB = [0, 1, 2, 3].map((i) => sat(`b${i}`, 150 + i * 0.1, 0));
    const result = aggregateSkyObjects([...anchors(), ...knotA, ...knotB]);
    expect(result.regime).toBe('individual');
    expect(result.renderables.every((r) => r.kind === 'object')).toBe(true);
    expect(result.renderables).toHaveLength(anchors().length + knotA.length + knotB.length);
  });

  it('anchors are unaffected by nearby satellite proximity — a satellite knot positioned on the pinned ISS', () => {
    const onIss = [0, 1, 2, 3, 4].map((i) => sat(`x${i}`, 120 + i * 0.1, 40));
    const result = aggregateSkyObjects([...anchors(), ...onIss]);
    const individualIds = result.renderables
      .filter((r) => r.kind === 'object')
      .map((r) => (r.kind === 'object' ? r.object.id : ''));
    expect(individualIds).toContain('iss');
    expect(individualIds).toContain('jupiter');
    expect(individualIds).toContain('sun');
    for (const x of onIss) expect(individualIds).toContain(x.id);
    expect(result.renderables).toHaveLength(anchors().length + onIss.length);
  });

  it('is deterministic and input-order independent', () => {
    const population = [...anchors(), ...scatteredSats(24, 7)];
    const shuffled = [...population].reverse();
    expect(aggregateSkyObjects(shuffled)).toEqual(aggregateSkyObjects(population));
  });

  it('a large spread population renders as individuals, never the shell', () => {
    const spread = Array.from({ length: 40 }, (_, i) =>
      sat(`s${String(i).padStart(2, '0')}`, i * 9, 10 + (i % 5) * 15),
    );
    const result = aggregateSkyObjects([...anchors(), ...spread]);
    expect(result.regime).not.toBe('shell');
    expect(result.renderables.some((r) => r.kind === 'shell')).toBe(false);
    const individualSatIds = result.renderables
      .filter((r) => r.kind === 'object' && r.object.kind === 'satellite' && !r.object.pinned)
      .map((r) => (r.kind === 'object' ? r.object.id : ''));
    expect(individualSatIds).toHaveLength(40);
  });

  it('never produces the shell regime, for any satellite population size or seed', () => {
    for (const seed of [1, 42, 1337, 2026]) {
      for (const n of [0, 1, 4, 5, 8, 12, 20, 40, 60, 100, 174]) {
        const result = aggregateSkyObjects([...anchors(), ...scatteredSats(n, seed)]);
        expect(result.regime).not.toBe('shell');
        expect(result.regime).toBe('individual');
      }
    }
  });
});

describe('aggregateSkyObjects — anchors and accounting', () => {
  it('every anchor in the input is rendered as an individual object', () => {
    for (const seed of [1, 42, 1337, 2026]) {
      for (const n of [0, 1, 4, 5, 8, 12, 20, 40, 60, 100]) {
        const result = aggregateSkyObjects([...anchors(), ...scatteredSats(n, seed)]);
        const individualIds = result.renderables
          .filter((r) => r.kind === 'object')
          .map((r) => (r.kind === 'object' ? r.object.id : ''));
        for (const a of anchors()) expect(individualIds).toContain(a.id);
      }
    }
  });

  it('MAX_CLICKABLE_OBJECTS still bounds the (fixed, small) anchor roster', () => {
    expect(anchors().length).toBeLessThanOrEqual(MAX_CLICKABLE_OBJECTS);
  });

  it('every object in the input becomes exactly one renderable — nothing is aggregated', () => {
    const population = [...anchors(), ...scatteredSats(35, 5)];
    const result = aggregateSkyObjects(population);
    expect(result.renderables).toHaveLength(population.length);
    expect(clickables(result)).toBe(population.length);
    expect(result.clickableCount).toBe(population.length);
  });
});
