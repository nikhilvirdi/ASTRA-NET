import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bortleAt,
  loadBortleGrid,
  resetBortleGridCache,
  BORTLE_GRID_WIDTH,
  BORTLE_GRID_HEIGHT,
  DEFAULT_BORTLE_GRID_PATH,
} from './light-pollution.client.js';

describe('Light-Pollution Atlas static dataset', () => {
  beforeEach(() => {
    resetBortleGridCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetBortleGridCache();
    vi.restoreAllMocks();
  });

  it('loads the real ingested grid at the expected dimensions', () => {
    if (!fs.existsSync(DEFAULT_BORTLE_GRID_PATH)) {
      throw new Error(`${DEFAULT_BORTLE_GRID_PATH} not found — run the ingest script first`);
    }
    const grid = loadBortleGrid();
    expect(grid).not.toBeNull();
    expect(grid!.length).toBe(BORTLE_GRID_WIDTH * BORTLE_GRID_HEIGHT);
  });

  it('resolves plausible Bortle values for known locations', () => {
    // New York City — heavily light-polluted.
    expect(bortleAt(40.7128, -74.006)).toBeGreaterThanOrEqual(7);
    // Cherry Springs State Park — a designated dark-sky park. An 11 km grid
    // won't resolve its exact Bortle 2, but it must be far darker than NYC.
    expect(bortleAt(41.6656, -77.8231)).toBeLessThanOrEqual(5);
    // Mid-Pacific — pristine.
    expect(bortleAt(0, -140)).toBeLessThanOrEqual(2);
  });

  it('only ever returns values inside the Bortle 1-9 scale', () => {
    for (const [lat, lon] of [
      [0, 0],
      [51.5, -0.12],
      [-33.87, 151.21],
      [32.73, 74.87],
      [78.22, 15.65],
    ]) {
      const value = bortleAt(lat!, lon!);
      expect(value).not.toBeNull();
      expect(value!).toBeGreaterThanOrEqual(1);
      expect(value!).toBeLessThanOrEqual(9);
    }
  });

  it('clamps out-of-range coordinates to the grid edge rather than reading out of bounds', () => {
    // Exactly the poles/antimeridian land on the boundary index.
    expect(bortleAt(90, 180)).not.toBeNull();
    expect(bortleAt(-90, -180)).not.toBeNull();
    // Beyond-range inputs must still resolve, not return undefined.
    expect(bortleAt(95, 200)).not.toBeNull();
    expect(bortleAt(-95, -200)).not.toBeNull();
  });

  it('memoises: a second call does not re-read the file', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    loadBortleGrid();
    loadBortleGrid();
    bortleAt(0, 0);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it('degrades to null when the grid file is missing, without throwing', () => {
    const missing = path.join(os.tmpdir(), 'astranet-no-such-bortle-grid.bin');
    expect(loadBortleGrid(missing)).toBeNull();
    expect(bortleAt(40.7128, -74.006, missing)).toBeNull();
  });

  it('rejects a wrong-sized grid rather than reading garbage from it', () => {
    const truncated = path.join(os.tmpdir(), `astranet-truncated-bortle-${process.pid}.bin`);
    fs.writeFileSync(truncated, Buffer.alloc(1024, 3));
    try {
      expect(loadBortleGrid(truncated)).toBeNull();
      expect(bortleAt(0, 0, truncated)).toBeNull();
    } finally {
      fs.rmSync(truncated, { force: true });
    }
  });

  it('rejects an out-of-scale cell value rather than clamping it', () => {
    // A 0 would make darknessFromBortle return 1.125 and outrank every real site.
    const corrupt = path.join(os.tmpdir(), `astranet-corrupt-bortle-${process.pid}.bin`);
    fs.writeFileSync(corrupt, Buffer.alloc(BORTLE_GRID_WIDTH * BORTLE_GRID_HEIGHT, 0));
    try {
      expect(loadBortleGrid(corrupt)).not.toBeNull();
      expect(bortleAt(0, 0, corrupt)).toBeNull();
    } finally {
      fs.rmSync(corrupt, { force: true });
    }
  });
});
