import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOLUTION_DEG = 0.1;
const WIDTH = Math.round(360 / RESOLUTION_DEG); // 3600
const HEIGHT = Math.round(180 / RESOLUTION_DEG); // 1800

function getBortle(lat: number, lon: number, grid: Uint8Array): number {
  let x = Math.floor(((lon + 180) / 360) * WIDTH);
  let y = Math.floor(((90 - lat) / 180) * HEIGHT);

  // Clamp to bounds
  x = Math.max(0, Math.min(WIDTH - 1, x));
  y = Math.max(0, Math.min(HEIGHT - 1, y));

  return grid[y * WIDTH + x]!;
}

describe('Light-Pollution Atlas Static Dataset', () => {
  it('should load bortle-grid.bin and resolve valid Bortle values for known locations', () => {
    const dataPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'web',
      'public',
      'data',
      'bortle-grid.bin',
    );

    if (!fs.existsSync(dataPath)) {
      throw new Error(`${dataPath} not found — run the ingest script first`);
    }

    const buffer = fs.readFileSync(dataPath);
    const grid = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    expect(grid.length).toBe(WIDTH * HEIGHT);

    // New York City (bright, Bortle 8-9)
    const nycLat = 40.7128;
    const nycLon = -74.006;
    const nycBortle = getBortle(nycLat, nycLon, grid);
    expect(nycBortle).toBeGreaterThanOrEqual(7);

    // Cherry Springs State Park (dark sky park, Bortle 2)
    const csLat = 41.6656;
    const csLon = -77.8231;
    const csBortle = getBortle(csLat, csLon, grid);
    // Might not be exactly 2 in a downsampled 11km grid, but should be much darker than NYC
    expect(csBortle).toBeLessThanOrEqual(5);

    // Pacific Ocean (pristine dark, Bortle 1)
    const oceanLat = 0;
    const oceanLon = -140;
    const oceanBortle = getBortle(oceanLat, oceanLon, grid);
    expect(oceanBortle).toBeLessThanOrEqual(2);
  });
});
