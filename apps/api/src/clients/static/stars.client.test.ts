import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Bright-Star Catalog Static Dataset', () => {
  it('should load stars.bin and parse reasonable values for Sirius', () => {
    const dataPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'web',
      'public',
      'data',
      'stars.bin',
    );

    if (!fs.existsSync(dataPath)) {
      throw new Error(`${dataPath} not found — run the ingest script first`);
    }

    const buffer = fs.readFileSync(dataPath);
    const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

    expect(floatArray.length % 5).toBe(0);
    const starCount = floatArray.length / 5;
    expect(starCount).toBeGreaterThan(5000); // Should be around 9000

    let siriusFound = false;
    for (let i = 0; i < starCount; i++) {
      const idx = i * 5;
      const ra = floatArray[idx]!;
      const dec = floatArray[idx + 1]!;
      const mag = floatArray[idx + 3]!;

      // Sirius (alpha CMa): RA ~101.28 deg (6h 45m), Dec ~-16.7 deg, mag ~-1.44
      if (Math.abs(ra - 101.28) < 0.5 && Math.abs(dec - -16.7) < 0.5 && mag < 0) {
        siriusFound = true;
        const distPc = floatArray[idx + 2];
        const bv = floatArray[idx + 4];

        expect(distPc).toBeCloseTo(2.64, 1); // Sirius is ~2.64 pc away
        expect(bv).toBeLessThan(0.1); // Sirius is A1V, B-V ~0.0
        break;
      }
    }

    expect(siriusFound).toBe(true);
  });
});
