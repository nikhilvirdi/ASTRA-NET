import axios from 'axios';
import { prisma } from '../index';
import redis from '../lib/redis';
import logger from '../utils/logger';

// Bounding box for India (south, west, north, east)
const INDIA_BBOX = '6.5,68.0,35.5,97.4';
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || process.env.NASA_API_KEY || 'DEMO_KEY';

/**
 * Fetch active fire hotspots from NASA FIRMS (VIIRS I-Band 375m NRT)
 * FIRMS CSV API: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{BBOX}/{DAYS}
 */
export async function fetchFireHotspots(): Promise<any[]> {
    try {
        const cacheKey = 'earth:firms:fires';
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        logger.info('Fetching live NASA FIRMS/VIIRS fire data for India...');

        // VIIRS 375m NRT is the most current near-real-time product
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/${INDIA_BBOX}/1`;
        const response = await axios.get(url, { timeout: 15000 });

        const raw = response.data as string;
        if (!raw || raw.includes('Error') || raw.includes('error')) {
            logger.warn(`FIRMS returned error or empty data. Skipping.`);
            return [];
        }

        // Parse CSV: each line is a hotspot. Header is line 0.
        const lines = raw.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());

        // Map column index by name (FIRMS format may vary)
        const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        const iLat = idx('latitude');
        const iLon = idx('longitude');
        const iBright = idx('bright_ti4');   // VIIRS brightness (Ti4 band)
        const iDate = idx('acq_date');
        const iTime = idx('acq_time');       // HHMM
        const iConf = idx('confidence');     // l/n/h or 0-100
        const iFrp  = idx('frp');

        const hotspots: any[] = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 8) continue;

            const lat = parseFloat(parts[iLat] ?? '0');
            const lon = parseFloat(parts[iLon] ?? '0');
            const brightness = parseFloat(parts[iBright] ?? '0');
            const frp = parseFloat(parts[iFrp] ?? String(brightness));
            const conf = (parts[iConf] ?? 'n').trim();
            const acqDate = (parts[iDate] ?? '').trim();
            const acqTime = (parts[iTime] ?? '0000').trim().padStart(4, '0');

            if (!acqDate || isNaN(lat) || isNaN(lon)) continue;

            const isoStr = `${acqDate}T${acqTime.slice(0,2)}:${acqTime.slice(2,4)}:00Z`;
            const timestamp = new Date(isoStr);
            if (isNaN(timestamp.getTime())) continue;

            hotspots.push({ latitude: lat, longitude: lon, brightness: frp, confidence: conf, timestamp });
        }

        if (hotspots.length > 0) {
            // Clear old + insert fresh snapshot. Use sequential, not $transaction, because
            // TimescaleDB hypertables don't support parallel DDL + DML in a transaction block.
            await prisma.fireHotspot.deleteMany({});
            await prisma.fireHotspot.createMany({ data: hotspots, skipDuplicates: true });
            logger.info(`FIRMS: saved ${hotspots.length} fire hotspots to DB.`);
        }

        // Cache for 30 minutes
        await redis.setex(cacheKey, 1800, JSON.stringify(hotspots));
        return hotspots;

    } catch (error: any) {
        logger.error('Error fetching FIRMS fire data:', error.message);
        return [];
    }
}
