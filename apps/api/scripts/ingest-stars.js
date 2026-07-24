import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HYG-Database (astronexus) is archived on GitHub; raw content is still
// served from the archived repo's `main` branch at this path.
const HYG_URL =
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const MAG_LIMIT = 6.5;

/**
 * Output binary layout (consumed by the Phase 8 runtime loader in apps/web):
 *
 *   Float32Array, 5 fields per star, row-major:
 *     [0] ra_deg       — right ascension, degrees (0-360)
 *     [1] dec_deg      — declination, degrees (-90..90)
 *     [2] dist_pc      — distance, parsecs, RAW from HYG's `dist` column.
 *                        Bad/missing-parallax stars are sentineled at
 *                        100000 pc (100 kpc) by HYG itself — this is passed
 *                        through unfiltered/unmodified, matching
 *                        FORMULAS.md §1's "pin bad parallax to a 100 kpc
 *                        shell" convention exactly (not a coincidence: HYG's
 *                        sentinel and our engine's fallback shell are the
 *                        same value). Callers needing distance_pc for
 *                        packages/shared/src/engines/star-position.ts's
 *                        starCartesianPosition() can use this field
 *                        directly — no parallax inversion needed.
 *     [3] vmag         — apparent visual magnitude
 *     [4] colorIndex   — B-V color index (HYG's `ci` column, already B-V —
 *                        NOT Gaia bp_rp, so bvFromGaiaBpRp() must not be
 *                        applied to this data)
 *
 * Only the Sun (HYG's origin object, distance 0) is excluded — it is not a
 * background star and would render as an oversized point at a bogus fixed
 * position. Every actual star with vmag <= 6.5 passes through, sentinel
 * distances included, per FORMULAS.md §1's "never drop, pin instead" rule.
 */
async function ingestStars() {
  console.log(`Fetching HYG database from ${HYG_URL}...`);
  const response = await fetch(HYG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  console.log('Parsing CSV data...');

  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, ''));

  const idxRa = headers.indexOf('ra');
  const idxDec = headers.indexOf('dec');
  const idxDist = headers.indexOf('dist');
  const idxMag = headers.indexOf('mag');
  const idxCi = headers.indexOf('ci');

  if ([idxRa, idxDec, idxDist, idxMag, idxCi].includes(-1)) {
    throw new Error('Missing required columns in HYG database.');
  }

  // Float32Array format: [ra_deg, dec_deg, dist_pc, vmag, colorIndex]
  const starsData = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const mag = parseFloat(cols[idxMag]);

    // Only include stars visible to the naked eye (under very dark skies)
    if (isNaN(mag) || mag > MAG_LIMIT) {
      continue;
    }

    const raHours = parseFloat(cols[idxRa]);
    const decDeg = parseFloat(cols[idxDec]);
    // dist is already in parsecs (HYG v41), including the 100000 pc
    // sentinel for bad/missing parallax. Stored raw — no inversion, no
    // filtering.
    const distPc = parseFloat(cols[idxDist]);
    const ci = parseFloat(cols[idxCi]);

    if (isNaN(raHours) || isNaN(decDeg) || isNaN(distPc)) {
      skipped++;
      continue;
    }

    // Exclude the Sun: HYG carries it as the origin object at distance 0. It
    // isn't a background star and would render as a huge point at a bogus
    // fixed position. Real stars have distance > 0 (bad-parallax rows are
    // sentineled at 100000 pc), so distance 0 uniquely identifies it.
    if (distPc === 0) {
      skipped++;
      continue;
    }

    // Convert RA from hours to degrees (1 hour = 15 degrees)
    const raDeg = raHours * 15.0;

    // Use a default color index (e.g. 0.0 - A-type star) if missing
    const colorIndex = isNaN(ci) ? 0.0 : ci;

    starsData.push(raDeg, decDeg, distPc, mag, colorIndex);
  }

  console.log(`Extracted ${starsData.length / 5} bright stars. Skipped ${skipped} invalid entries.`);

  const floatArray = new Float32Array(starsData);
  const outDir = path.join(__dirname, '..', '..', 'web', 'public', 'data');
  const outFile = path.join(outDir, 'stars.bin');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(floatArray.buffer));

  console.log(`Success! Saved binary catalog to ${outFile} (${floatArray.byteLength} bytes)`);
}

ingestStars().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
