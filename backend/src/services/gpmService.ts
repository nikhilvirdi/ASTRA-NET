import axios from 'axios';
import { prisma } from '../index';
import redis from '../lib/redis';
import logger from '../utils/logger';

/**
 * Fetch rainfall data from Open-Meteo as a NASA GPM proxy.
 * Real NASA GPM IMERG requires Earthdata auth + heavy NetCDF parsing.
 * Open-Meteo provides daily precipitation totals via GFS/ICON at no cost.
 */

const FLOOD_DISTRICTS = [
    { state: 'Kerala',      district: 'Thiruvananthapuram', lat: 8.5241,  lon: 76.9366 },
    { state: 'Kerala',      district: 'Ernakulam',          lat: 9.9816,  lon: 76.2999 },
    { state: 'Kerala',      district: 'Kozhikode',          lat: 11.2588, lon: 75.7804 },
    { state: 'Karnataka',   district: 'Dakshina Kannada',   lat: 12.8700, lon: 75.1170 },
    { state: 'Karnataka',   district: 'Uttara Kannada',     lat: 14.7940, lon: 74.7240 },
    { state: 'Odisha',      district: 'Bhubaneswar',        lat: 20.2961, lon: 85.8245 },
    { state: 'Odisha',      district: 'Cuttack',            lat: 20.4625, lon: 85.8828 },
    { state: 'Assam',       district: 'Dibrugarh',          lat: 27.4728, lon: 94.9120 },
    { state: 'Assam',       district: 'Lakhimpur',          lat: 27.2368, lon: 94.1012 },
    { state: 'Maharashtra', district: 'Mumbai',             lat: 19.0760, lon: 72.8777 },
    { state: 'Tamil Nadu',  district: 'Chennai',            lat: 13.0827, lon: 80.2707 },
    { state: 'Andhra Pradesh', district: 'Visakhapatnam',  lat: 17.6868, lon: 83.2185 },
];

export async function fetchRainfallData(): Promise<any[]> {
    try {
        const cacheKey = 'earth:gpm:rainfall';
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        logger.info('Fetching precipitation data for India (Open-Meteo / GPM proxy)...');

        const events: any[] = [];

        for (const loc of FLOOD_DISTRICTS) {
            try {
                const res = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=precipitation_sum,precipitation_probability_max&past_days=7&forecast_days=1&timezone=Asia%2FKolkata`,
                    { timeout: 8000 }
                );

                const daily = res.data?.daily;
                if (!daily?.precipitation_sum) continue;

                const sums: number[] = daily.precipitation_sum.filter((v: any) => v != null);
                const rainTotal = sums.reduce((a, b) => a + b, 0);
                const rainMax   = Math.max(...sums);      // worst single day
                const rainAvg   = rainTotal / (sums.length || 1);

                // Historical pre-monsoon normal for these regions ≈ 30-50mm/week
                // Anomaly = actual - normal
                const NORMAL_WEEKLY = 40;
                const anomaly = parseFloat((rainTotal - NORMAL_WEEKLY).toFixed(1));

                // Severity thresholds (based on IMD flood alert criteria)
                let severity = 'MOD';
                if (rainTotal > 150) severity = 'HIGH';
                if (rainTotal > 300) severity = 'CRIT';

                events.push({
                    state:    loc.state,
                    district: loc.district,
                    severity,
                    rainfall:      parseFloat(rainTotal.toFixed(1)),
                    rainfallMax:   parseFloat(rainMax.toFixed(1)),
                    rainfallAnomaly: anomaly,
                    timestamp: new Date()
                });
            } catch (inner: any) {
                logger.warn(`GPM fetch failed for ${loc.district}: ${inner.message}`);
            }
        }

        if (events.length > 0) {
            // Sequential: delete old → insert fresh (TimescaleDB hypertable safe)
            await prisma.floodEvent.deleteMany({});
            await prisma.floodEvent.createMany({ data: events });
            logger.info(`GPM: saved ${events.length} flood events to DB.`);
        }

        // Cache for 6 hours (precipitation changes slowly)
        await redis.setex(cacheKey, 21600, JSON.stringify(events));
        return events;

    } catch (error: any) {
        logger.error('Error fetching rainfall data:', error.message);
        return [];
    }
}
