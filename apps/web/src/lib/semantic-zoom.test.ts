import { describe, expect, it } from 'vitest';
import {
  aggregateSkyObjects,
  angularSeparationDeg,
  drillFovDeg,
  fovToZoomLevel,
  MAX_CLICKABLE_OBJECTS,
  mergeRadiusDeg,
  sphericalCentroid,
  ZOOM_FOV_MIDPOINTS_DEG,
  type SkyObjectInput,
  type ZoomLevel,
} from './semantic-zoom';

const LEVELS: ZoomLevel[] = [0, 1, 2];

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
  it('shrinks as the camera zooms in, so clusters resolve', () => {
    expect(mergeRadiusDeg(0)).toBeLessThan(mergeRadiusDeg(1));
    expect(mergeRadiusDeg(1)).toBeLessThan(mergeRadiusDeg(2));
  });
});

describe('angularSeparationDeg', () => {
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

describe('aggregateSkyObjects — under the cap', () => {
  it("today's real roster (3 objects) passes through untouched at every level", () => {
    for (const level of LEVELS) {
      const result = aggregateSkyObjects(anchors(), level);
      expect(result.regime).toBe('individual');
      expect(result.renderables).toHaveLength(3);
      expect(result.renderables.every((r) => r.kind === 'object')).toBe(true);
      expect(result.clickableCount).toBe(3);
    }
  });

  it('exactly 7 objects stay individual even when packed tightly', () => {
    const packed = Array.from({ length: 7 }, (_, i) => sat(`s${i}`, 100 + i * 0.5, 45));
    for (const level of LEVELS) {
      const result = aggregateSkyObjects(packed, level);
      expect(result.regime).toBe('individual');
      expect(result.renderables).toHaveLength(7);
    }
  });

  it('an empty scene aggregates to an empty scene', () => {
    const result = aggregateSkyObjects([], 1);
    expect(result.renderables).toHaveLength(0);
    expect(result.clickableCount).toBe(0);
  });
});

describe('aggregateSkyObjects — clustered regime', () => {
  // Two tight knots of 4 satellites each + the 3 real anchors = 11 objects.
  // Knots are ~1.5° wide (inside every level's radius), 90° apart (outside
  // any escalated radius), so the expected result is exactly 2 clusters.
  function twoKnots(): SkyObjectInput[] {
    const knotA = [0, 1, 2, 3].map((i) => sat(`a${i}`, 60 + i * 0.5, 50 + (i % 2) * 0.5));
    const knotB = [0, 1, 2, 3].map((i) => sat(`b${i}`, 150 + i * 0.5, 50 + (i % 2) * 0.5));
    return [...anchors(), ...knotA, ...knotB];
  }

  it('merges tight knots into constellation clusters and obeys the cap', () => {
    for (const level of LEVELS) {
      const result = aggregateSkyObjects(twoKnots(), level);
      expect(result.regime).toBe('clustered');
      const clusters = result.renderables.filter((r) => r.kind === 'cluster');
      expect(clusters).toHaveLength(2);
      expect(clickables(result)).toBe(5);
      expect(result.clickableCount).toBe(5);
    }
  });

  it('cluster centroids sit inside their knot, members are the real objects sorted by id', () => {
    const result = aggregateSkyObjects(twoKnots(), 1);
    const clusterA = result.renderables.find((r) => r.kind === 'cluster' && r.id === 'cluster:a0');
    expect(clusterA).toBeDefined();
    if (clusterA?.kind !== 'cluster') throw new Error('unreachable');
    expect(clusterA.members.map((m) => m.id)).toEqual(['a0', 'a1', 'a2', 'a3']);
    expect(clusterA.azimuthDeg).toBeGreaterThan(59);
    expect(clusterA.azimuthDeg).toBeLessThan(62);
  });

  it('anchors (pinned ISS, planets, Sun) are never absorbed into a cluster', () => {
    // Put a satellite knot directly on top of the pinned ISS.
    const onIss = [0, 1, 2, 3, 4].map((i) => sat(`x${i}`, 120 + i * 0.3, 40 + i * 0.3));
    const result = aggregateSkyObjects([...anchors(), ...onIss], 2);
    const individualIds = result.renderables
      .filter((r) => r.kind === 'object')
      .map((r) => (r.kind === 'object' ? r.object.id : ''));
    expect(individualIds).toContain('iss');
    expect(individualIds).toContain('jupiter');
    expect(individualIds).toContain('sun');
    const cluster = result.renderables.find((r) => r.kind === 'cluster');
    expect(cluster?.kind === 'cluster' && cluster.members.some((m) => m.id === 'iss')).toBe(false);
  });

  it('is deterministic and input-order independent', () => {
    const population = [...anchors(), ...scatteredSats(24, 7)];
    const shuffled = [...population].reverse();
    for (const level of LEVELS) {
      expect(aggregateSkyObjects(shuffled, level)).toEqual(aggregateSkyObjects(population, level));
    }
  });

  it('cluster ids are stable when unrelated satellites appear elsewhere', () => {
    const base = aggregateSkyObjects(twoKnots(), 1);
    const withExtra = aggregateSkyObjects([...twoKnots(), sat('zz-far', 300, 10)], 1);
    const baseIds = base.renderables.filter((r) => r.kind === 'cluster').map((r) => r.id);
    const nextIds = withExtra.renderables.filter((r) => r.kind === 'cluster').map((r) => r.id);
    for (const id of baseIds) expect(nextIds).toContain(id);
  });

  it('zooming in resolves an aggregate into finer structure', () => {
    // Three 3-satellite knots with ~8.5° gaps between neighbouring knots:
    // inside level 2's 12° merge radius (one compact cluster), outside
    // level 0's 5.6° radius (three separate clusters).
    const knots = [100, 114, 128].flatMap((az, k) =>
      [0, 1, 2].map((i) => sat(`k${k}-${i}`, az + i, 45)),
    );
    const population = [...anchors(), ...knots];
    const wide = aggregateSkyObjects(population, 2);
    const close = aggregateSkyObjects(population, 0);
    expect(wide.renderables.filter((r) => r.kind === 'cluster')).toHaveLength(1);
    expect(close.renderables.filter((r) => r.kind === 'cluster')).toHaveLength(3);
    expect(close.renderables.length).toBeGreaterThan(wide.renderables.length);
  });
});

describe('aggregateSkyObjects — shell regime', () => {
  it('collapses a large spread population into the single orbital shell', () => {
    // 40 satellites spread evenly around the compass at varying altitudes:
    // no bounded radius widening can fit them into the budget of 4.
    const spread = Array.from({ length: 40 }, (_, i) =>
      sat(`s${String(i).padStart(2, '0')}`, i * 9, 10 + (i % 5) * 15),
    );
    const result = aggregateSkyObjects([...anchors(), ...spread], 2);
    expect(result.regime).toBe('shell');
    const shell = result.renderables.find((r) => r.kind === 'shell');
    expect(shell?.kind === 'shell' && shell.count).toBe(40);
    expect(result.clickableCount).toBe(4);
  });

  it('keeps the shell clickable-core comfortably above the horizon', () => {
    const lowSats = Array.from({ length: 30 }, (_, i) => sat(`s${i}`, i * 12, 2));
    const result = aggregateSkyObjects([...anchors(), ...lowSats], 2);
    const shell = result.renderables.find((r) => r.kind === 'shell');
    expect(shell?.kind === 'shell' && shell.altitudeDeg >= 15).toBe(true);
  });
});

describe('aggregateSkyObjects — the Rule of 7 invariant', () => {
  it('never exceeds 7 clickables for any population size, seed, or level', () => {
    for (const seed of [1, 42, 1337, 2026]) {
      for (const n of [0, 1, 4, 5, 8, 12, 20, 40, 60, 100]) {
        for (const level of LEVELS) {
          const result = aggregateSkyObjects([...anchors(), ...scatteredSats(n, seed)], level);
          expect(clickables(result)).toBeLessThanOrEqual(MAX_CLICKABLE_OBJECTS);
          expect(result.clickableCount).toBe(clickables(result));
        }
      }
    }
  });

  it('aggregates rather than hides: every satellite is accounted for', () => {
    for (const level of LEVELS) {
      const population = [...anchors(), ...scatteredSats(35, 5)];
      const result = aggregateSkyObjects(population, level);
      let accounted = 0;
      for (const r of result.renderables) {
        if (r.kind === 'object') accounted += 1;
        else if (r.kind === 'cluster') accounted += r.members.length;
        else accounted += r.count;
      }
      expect(accounted).toBe(population.length);
    }
  });
});
