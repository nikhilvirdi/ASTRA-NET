/// <reference types="vite/client" />
import type { SkyObjectInput } from './semantic-zoom';

/**
 * DEV-ONLY visual test rig for the semantic-zoom system: a deterministic
 * simulated satellite population, injected only when the app runs in a dev
 * build with `?simSats=N` in the URL. Production builds never contain these
 * objects — a fabricated sky position in the product would violate the
 * no-fictional-objects rule; a labeled instrument in a dev build does not.
 * Every marker generated here is explicitly labeled SIMULATED in its id.
 *
 * The real satellite population arrives with the Phase 8 "clickable
 * ISS/satellites" workstream (CelesTrak group + client-side satellite.js
 * propagation, both named in ARCHITECTURE.md/API_SOURCES.md); this rig
 * exists so the cluster/shell states are visually verifiable before then.
 */

/** mulberry32 — tiny seeded PRNG; deterministic across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIM_SEED = 20260724;

/** Parse `?simSats=N` (dev builds only); 0 disables. Clamped to [0, 200]. */
export function simSatCountFromSearch(search: string): number {
  if (!import.meta.env.DEV) return 0;
  const raw = new URLSearchParams(search).get('simSats');
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 200);
}

/**
 * N simulated satellites, uniformly distributed over the visible dome
 * (sin(alt) uniform → uniform area density, which biases counts toward the
 * horizon the way a real LEO population reads from the ground).
 */
export function simulatedSatellites(count: number): SkyObjectInput[] {
  const rand = mulberry32(SIM_SEED);
  return Array.from({ length: count }, (_, i) => ({
    id: `sim-sat-${String(i).padStart(3, '0')}`,
    kind: 'satellite' as const,
    azimuthDeg: rand() * 360,
    altitudeDeg: (Math.asin(rand()) * 180) / Math.PI,
  }));
}

/**
 * Chooses between the dev-only simulated satellite population and the real
 * feed. Real satellites win whenever `?simSats` is absent/zero/invalid —
 * i.e. every production request, and every dev request that isn't
 * explicitly asking for the sim rig — even if the real feed happens to be
 * empty (e.g. before `/api/satellites` first resolves).
 *
 * A prior version of this check compared `simSatCountFromSearch()`'s return
 * (always a plain `number`; 0 means disabled) against `null`, which is never
 * true — the real-feed branch was unreachable in every configuration. See
 * DECISIONS.md.
 */
export function resolveSatelliteFeed<T>(search: string, simObjects: T[], realObjects: T[]): T[] {
  return simSatCountFromSearch(search) > 0 ? simObjects : realObjects;
}
