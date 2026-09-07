/**
 * Light-pollution (Bortle) static dataset client.
 *
 * Reads the pre-ingested `bortle-grid.bin` — a 3600x1800 `Uint8Array` at
 * 0.1 degree resolution (~11 km at the equator), one Bortle class 1-9 per
 * cell — produced by `scripts/ingest-light-pollution.js` from NASA's Black
 * Marble composite. No network dependency: the grid is a local file, loaded
 * once and memoised for the process lifetime (6.5 MB).
 *
 * API_SOURCES.md's caveat carries through to every consumer: these values
 * are a **luma approximation** off a rendered poster-image JPEG, not
 * calibrated VIIRS radiance. Good for relative darkness ranking in §11
 * Best-Spot scoring; not a scientific radiance claim.
 *
 * Follows the same never-throws contract as the network clients: a missing,
 * truncated, or corrupt grid degrades to `null` rather than throwing, so
 * `/api/best-spot` can report darkness as unavailable instead of 500ing.
 *
 * The grid file physically lives under `apps/web/public/data/` because the
 * frontend map layer serves it as a static asset too. This client reads it
 * from there rather than duplicating a 6.5 MB binary into `apps/api` — see
 * DECISIONS.md. The relative path resolves identically from `src/` and from
 * the compiled `dist/`, since both sit at the same depth under `apps/api`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RESOLUTION_DEG = 0.1;
export const BORTLE_GRID_WIDTH = Math.round(360 / RESOLUTION_DEG); // 3600
export const BORTLE_GRID_HEIGHT = Math.round(180 / RESOLUTION_DEG); // 1800

const MIN_BORTLE = 1;
const MAX_BORTLE = 9;

export const DEFAULT_BORTLE_GRID_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'web',
  'public',
  'data',
  'bortle-grid.bin',
);

/** `undefined` = not yet attempted; `null` = attempted and unavailable. */
let cachedGrid: Uint8Array | null | undefined;
let cachedPath: string | undefined;

/** Test seam — forces the next `loadBortleGrid` call to re-read from disk. */
export function resetBortleGridCache(): void {
  cachedGrid = undefined;
  cachedPath = undefined;
}

/**
 * Loads and memoises the grid. Returns `null` — never throws — if the file
 * is missing or is not the expected size, since a wrong-sized buffer would
 * silently produce garbage Bortle values rather than an honest failure.
 */
export function loadBortleGrid(gridPath: string = DEFAULT_BORTLE_GRID_PATH): Uint8Array | null {
  if (cachedGrid !== undefined && cachedPath === gridPath) return cachedGrid;

  cachedPath = gridPath;
  try {
    const buffer = fs.readFileSync(gridPath);
    const grid = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    if (grid.length !== BORTLE_GRID_WIDTH * BORTLE_GRID_HEIGHT) {
      console.error(
        `[light-pollution] grid at ${gridPath} is ${grid.length} bytes, expected ${BORTLE_GRID_WIDTH * BORTLE_GRID_HEIGHT} — ignoring`,
      );
      cachedGrid = null;
      return null;
    }

    cachedGrid = grid;
    return grid;
  } catch (err) {
    console.error(
      `[light-pollution] could not read grid at ${gridPath}:`,
      err instanceof Error ? err.message : String(err),
    );
    cachedGrid = null;
    return null;
  }
}

/**
 * Bortle class (1-9) at a coordinate, or `null` if the grid is unavailable
 * or the cell holds an out-of-range value.
 *
 * Out-of-range cells are rejected rather than clamped because
 * `darknessFromBortle` is `(9 - bortle) / 8`: a 0 would yield a darkness
 * factor of 1.125, quietly breaking §11's [0,1] invariant and letting a
 * corrupt cell outrank every real site.
 */
export function bortleAt(
  latDeg: number,
  lonDeg: number,
  gridPath: string = DEFAULT_BORTLE_GRID_PATH,
): number | null {
  const grid = loadBortleGrid(gridPath);
  if (grid === null) return null;

  const x = Math.min(
    BORTLE_GRID_WIDTH - 1,
    Math.max(0, Math.floor(((lonDeg + 180) / 360) * BORTLE_GRID_WIDTH)),
  );
  const y = Math.min(
    BORTLE_GRID_HEIGHT - 1,
    Math.max(0, Math.floor(((90 - latDeg) / 180) * BORTLE_GRID_HEIGHT)),
  );

  const value = grid[y * BORTLE_GRID_WIDTH + x];
  if (value === undefined || value < MIN_BORTLE || value > MAX_BORTLE) return null;
  return value;
}
