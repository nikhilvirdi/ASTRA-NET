import axios from 'axios';
import { prisma } from '../index';
import redis from '../lib/redis';
import logger from '../utils/logger';

/**
 * TLE Data Sources (CelesTrak direct .txt paths deprecated July 2024)
 *
 * Primary: CelesTrak GP Data API — https://celestrak.org/SOCRATES/query.php?CATNR=...&FORMAT=TLE
 *          • Requires individual NORAD IDs  
 *          • Best for high-priority satellites
 *
 * Bulk Alternative: https://tle.ivanstanojevic.me/api/tle — TLE JSON wrapper around CelesTrak
 *          • Free, no auth, returns JSON with tle1/tle2 fields
 *          • Supports ?search=... and ?page=... pagination
 */

const HEADERS = { 'User-Agent': 'ASTRA-NET/1.0 contact@astra-net.io' };

// Key NORAD IDs for priority tracking (ISS, Tiangong, NOAA, Landsat, etc.)
const PRIORITY_NORAD_IDS = [25544, 48274, 33591, 28654, 43013, 49044, 47951];

// Bulk category searches using the tle.ivanstanojevic.me API
const TLE_SEARCH_TERMS = [
  { search: 'ISS', type: 'SPACE_STATION' },
  { search: 'STARLINK', type: 'PAYLOAD' },
  { search: 'NOAA', type: 'PAYLOAD' },
  { search: 'COSMOS', type: 'DEBRIS' },
  { search: 'IRIDIUM', type: 'PAYLOAD' },
  { search: 'FENGYUN', type: 'DEBRIS' },
];

async function fetchFromIvanAPI(search: string, type: string): Promise<any[]> {
  const url = `https://tle.ivanstanojevic.me/api/tle/?search=${encodeURIComponent(search)}&page-size=50`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
  const items = res.data?.member ?? [];
  return items.map((item: any) => ({
    noradId: item.satelliteId,
    name: item.name,
    type,
    tle1: item.line1,
    tle2: item.line2,
    epoch: parseEpoch(item.line1)
  })).filter((s: any) => s.noradId && s.tle1 && s.tle2);
}

async function fetchFromCelesTrakByNorad(noradId: number, type: string): Promise<any | null> {
  const url = `https://celestrak.org/SOCRATES/query.php?CATNR=${noradId}&FORMAT=TLE`;
  const res = await axios.get(url, { headers: HEADERS, responseType: 'text', timeout: 10000 });
  const raw = res.data as string;
  if (!raw || raw.includes('No TLE') || raw.length < 60) return null;

  const lines = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  if (lines.length < 3) return null;

  const [name, tle1, tle2] = lines;
  if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) return null;

  return {
    noradId, name: name.trim(), type, tle1, tle2,
    epoch: parseEpoch(tle1)
  };
}

function parseEpoch(tle1: string): Date {
  try {
    const epochStr = tle1.substring(18, 32).trim();
    const year2d = parseInt(epochStr.substring(0, 2), 10);
    const dayFraction = parseFloat(epochStr.substring(2));
    const year = year2d >= 57 ? 1900 + year2d : 2000 + year2d;
    const d = new Date(Date.UTC(year, 0, 1));
    d.setTime(d.getTime() + (dayFraction - 1) * 86400000);
    return d;
  } catch (_) {
    return new Date();
  }
}

export async function fetchTLEData(): Promise<any[]> {
  try {
    const cacheKey = 'orbital:tle:all';
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    logger.info('Fetching TLE data from CelesTrak GP API + tle.ivanstanojevic.me...');
    const allSatellites: any[] = [];

    // 1. Bulk search via Ivan's TLE API (most reliable free bulk source)
    for (const { search, type } of TLE_SEARCH_TERMS) {
      try {
        const sats = await fetchFromIvanAPI(search, type);
        logger.info(`TLE search "${search}": ${sats.length} satellites`);
        allSatellites.push(...sats);
      } catch (e: any) {
        logger.warn(`TLE search "${search}" failed: ${e.message}`);
      }
    }

    // 2. Priority satellites from CelesTrak directly
    for (const noradId of PRIORITY_NORAD_IDS) {
      try {
        const sat = await fetchFromCelesTrakByNorad(noradId, 'SPACE_STATION');
        if (sat) allSatellites.push(sat);
      } catch (_) {}
    }

    if (allSatellites.length === 0) {
      logger.warn('All TLE feeds failed. Returning existing DB satellites.');
      return await prisma.satellite.findMany({ take: 200 });
    }

    // Deduplicate by NORAD ID
    const byNorad = new Map<number, any>();
    for (const sat of allSatellites) {
      if (sat.noradId && !byNorad.has(sat.noradId)) byNorad.set(sat.noradId, sat);
    }
    const unique = [...byNorad.values()];

    // Upsert into Satellite table
    for (const sat of unique.slice(0, 500)) {
      try {
        await prisma.satellite.upsert({
          where: { noradId: sat.noradId },
          create: { noradId: sat.noradId, name: sat.name, type: sat.type, tle1: sat.tle1, tle2: sat.tle2, epoch: sat.epoch },
          update: { name: sat.name, tle1: sat.tle1, tle2: sat.tle2, epoch: sat.epoch }
        });
      } catch (_) {}
    }

    // Snapshot TLE history
    const records = unique.slice(0, 500).map(s => ({
      noradId: s.noradId, tle1: s.tle1, tle2: s.tle2, timestamp: new Date()
    }));
    if (records.length > 0) {
      await prisma.tLERecord.createMany({ data: records, skipDuplicates: true });
    }

    await redis.setex(cacheKey, 21600, JSON.stringify(unique.slice(0, 500)));
    logger.info(`TLE data: ${unique.length} unique satellites stored.`);
    return unique;

  } catch (error: any) {
    logger.error('Error fetching TLE data:', error.message);
    return [];
  }
}
