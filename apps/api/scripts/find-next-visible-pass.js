/**
 * One-off diagnostic script — NOT part of the app, not imported by anything
 * in apps/api/src or apps/web/src. Answers a single question: when is the
 * next real-world moment a genuinely visible (non-simulated) satellite pass
 * happens over Jammu, so a human can open a real browser at /explore at
 * that exact time and confirm the real satellite feed actually renders
 * end-to-end — something that has only been reasoned about/unit-tested so
 * far, never seen working live. See DECISIONS.md 2026-07-27.
 *
 * Mirrors two already-shipped pieces exactly, rather than reinventing them:
 *   - The propagation pipeline in apps/web/src/hooks/useSatellites.ts
 *     (satellite.js: twoline2satrec -> propagate -> eciToEcf ->
 *     ecfToLookAngles).
 *   - The FORMULAS.md §5 visible-pass test already wired into that same
 *     hook: packages/shared's isVisiblePass(elevationDeg, sunAltObserverDeg,
 *     satellitePosition, sunUnitVector) — elevation >= 10deg AND observer in
 *     darkness (sun alt < -6deg) AND the satellite outside Earth's shadow.
 *
 * Data source: CelesTrak's "visual" GROUP directly (same TLE set
 * apps/api/src/poller/slow-tier.ts polls into /api/satellites) — fetched
 * here directly rather than depending on a running backend/DB, since this
 * is a read-only diagnostic.
 *
 * Run: node apps/api/scripts/find-next-visible-pass.js
 */

import * as satellite from 'satellite.js';
import { isVisiblePass, julianDay, sunAltitudeDeg, sunEquatorialPosition } from '@astranet/shared';

// Jammu — apps/web/src/lib/api.ts's DEFAULT_OBSERVER_LOCATION (ratified
// 2026-07-27, see DECISIONS.md).
const OBSERVER_LAT_DEG = 32.73;
const OBSERVER_LON_DEG = 74.87;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?FORMAT=tle&GROUP=visual';
// Matches apps/api/src/poller/slow-tier.ts's MAX_SATELLITES defensive cap.
const MAX_SATELLITES = 200;

const SCAN_STEP_MS = 10_000; // 10s resolution — plenty precise for "when to look"
const MAX_SCAN_HOURS = 72;

function toIstString(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const mi = String(ist.getUTCMinutes()).padStart(2, '0');
  const s = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s} IST`;
}

async function fetchVisualGroupTle() {
  const res = await fetch(CELESTRAK_URL);
  if (!res.ok) throw new Error(`CelesTrak fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '');

  const records = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
      records.push({ name, line1, line2 });
    }
  }
  return records.slice(0, MAX_SATELLITES);
}

function buildSatrecs(records) {
  const satrecs = [];
  for (const r of records) {
    try {
      satrecs.push({ name: r.name, satrec: satellite.twoline2satrec(r.line1, r.line2) });
    } catch {
      // Skip unparsable TLEs — same tolerance as useSatellites.ts.
    }
  }
  return satrecs;
}

/** One tick: which satellites currently pass the same isVisiblePass() test useSatellites.ts applies. */
function computeVisibleSatellites(satrecs, now) {
  const gmst = satellite.gstime(now);
  const observerGd = {
    longitude: satellite.degreesToRadians(OBSERVER_LON_DEG),
    latitude: satellite.degreesToRadians(OBSERVER_LAT_DEG),
    height: 0,
  };

  const sunAltObserverDeg = sunAltitudeDeg(now, OBSERVER_LAT_DEG, OBSERVER_LON_DEG);
  const jd = julianDay(now);
  const { raDeg, decDeg } = sunEquatorialPosition(jd);
  const raRad = satellite.degreesToRadians(raDeg);
  const decRad = satellite.degreesToRadians(decDeg);
  const sunUnitVector = {
    x: Math.cos(decRad) * Math.cos(raRad),
    y: Math.cos(decRad) * Math.sin(raRad),
    z: Math.sin(decRad),
  };

  const visible = [];
  for (const { name, satrec } of satrecs) {
    const positionAndVelocity = satellite.propagate(satrec, now);
    const positionEci = positionAndVelocity.position;
    if (!positionEci || typeof positionEci === 'boolean') continue;

    const positionEcf = satellite.eciToEcf(positionEci, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
    const altitudeDeg = satellite.radiansToDegrees(lookAngles.elevation);
    const azimuthDeg = satellite.radiansToDegrees(lookAngles.azimuth);

    if (isVisiblePass(altitudeDeg, sunAltObserverDeg, positionEci, sunUnitVector)) {
      visible.push({ name, altitudeDeg, azimuthDeg });
    }
  }
  return visible;
}

async function main() {
  console.log('Fetching CelesTrak "visual" group TLEs...');
  const records = await fetchVisualGroupTle();
  console.log(`Fetched ${records.length} TLE records (capped at ${MAX_SATELLITES}).`);

  const satrecs = buildSatrecs(records);
  console.log(`Parsed ${satrecs.length} valid SatRecs.`);

  const now = new Date();
  console.log(
    `Scanning forward from ${now.toISOString()} UTC (${toIstString(now)}) at Jammu ` +
      `(${OBSERVER_LAT_DEG}N, ${OBSERVER_LON_DEG}E), step=${SCAN_STEP_MS / 1000}s, ` +
      `max ${MAX_SCAN_HOURS}h...`,
  );

  let windowSatelliteName = null;
  let windowStart = null;
  let windowEnd = null;
  let windowMaxAlt = -90;

  let t = now.getTime();
  const endScan = now.getTime() + MAX_SCAN_HOURS * 3_600_000;

  while (t <= endScan) {
    const current = new Date(t);
    const visible = computeVisibleSatellites(satrecs, current);

    if (windowSatelliteName === null) {
      if (visible.length > 0) {
        visible.sort((a, b) => b.altitudeDeg - a.altitudeDeg);
        windowSatelliteName = visible[0].name;
        windowStart = current;
        windowMaxAlt = visible[0].altitudeDeg;
      }
    } else {
      const stillVisible = visible.find((v) => v.name === windowSatelliteName);
      if (stillVisible) {
        windowMaxAlt = Math.max(windowMaxAlt, stillVisible.altitudeDeg);
      } else {
        windowEnd = current;
        break;
      }
    }

    t += SCAN_STEP_MS;
  }

  console.log('');
  if (windowSatelliteName === null) {
    console.log(
      `No visible pass found for any of the ${satrecs.length} satellites within ${MAX_SCAN_HOURS}h.`,
    );
    return;
  }
  if (windowEnd === null) {
    windowEnd = new Date(t); // Scan window ended while the pass was still ongoing.
  }

  console.log('=== NEXT VISIBLE SATELLITE PASS OVER JAMMU ===');
  console.log(`Satellite: ${windowSatelliteName}`);
  console.log(`Peak altitude during window: ${windowMaxAlt.toFixed(1)} deg`);
  console.log(`Window start: ${windowStart.toISOString()} UTC  |  ${toIstString(windowStart)}`);
  console.log(`Window end:   ${windowEnd.toISOString()} UTC  |  ${toIstString(windowEnd)}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exitCode = 1;
});
