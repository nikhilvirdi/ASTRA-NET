import cron from 'node-cron';
import axios from 'axios';
import redisClient from '../lib/redis';
import logger from '../utils/logger';

// NOAA Space Weather Prediction Center APIs (Public, no key required)
const NOAA_KP_URL = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const NOAA_WIND_URL = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json';
const NOAA_BZ_URL = 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json';

export const startNoaaCron = () => {
    cron.schedule('*/5 * * * *', async () => {
        try {
            logger.info('⏳ [CRON] Fetching NOAA SWPC Data (Kp, Wind, Bz)...');

            const [kpRes, windRes, bzRes] = await Promise.all([
                axios.get(NOAA_KP_URL),
                axios.get(NOAA_WIND_URL),
                axios.get(NOAA_BZ_URL)
            ]);

            // Cache responses in Redis with a 10-minute TTL
            await redisClient.setex('solar:noaa:kp', 600, JSON.stringify(kpRes.data));
            await redisClient.setex('solar:noaa:wind', 600, JSON.stringify(windRes.data));
            await redisClient.setex('solar:noaa:bz', 600, JSON.stringify(bzRes.data));

            // We must call recalculate in the main Aditya Engine loop instead.
            // By emitting an event or letting a separate cron handle scoring,
            // we decouple fetching from the actual intelligence object assembly.

            logger.info(`✅ [CRON] NOAA Data cached for Kp, Wind, and Bz.`);
        } catch (error) {
            logger.error('❌ [CRON] Failed to fetch NOAA SWPC data:', error);
        }
    });

    logger.info('🚀 [INIT] Bootstrapping initial NOAA SWPC data...');
    Promise.all([
        axios.get(NOAA_KP_URL),
        axios.get(NOAA_WIND_URL),
        axios.get(NOAA_BZ_URL)
    ]).then(async ([kpRes, windRes, bzRes]) => {
        await redisClient.setex('solar:noaa:kp', 600, JSON.stringify(kpRes.data));
        await redisClient.setex('solar:noaa:wind', 600, JSON.stringify(windRes.data));
        await redisClient.setex('solar:noaa:bz', 600, JSON.stringify(bzRes.data));
        logger.info(`✅ [INIT] NOAA Bootstrap complete.`);
    }).catch((err) => logger.error("Failed NOAA bootstrap", err));
};
