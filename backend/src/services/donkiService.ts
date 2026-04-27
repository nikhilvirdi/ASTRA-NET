import cron from 'node-cron';
import axios from 'axios';
import redisClient from '../lib/redis';
import logger from '../utils/logger';

const NASA_API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const DONKI_CME_URL = `https://api.nasa.gov/DONKI/CME?api_key=${NASA_API_KEY}`;

export const startDonkiCron = () => {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        try {
            logger.info('⏳ [CRON] Fetching NASA DONKI CME & FLR Data...');

            // Generate dynamic startDate 7 days ago
            const d = new Date();
            d.setDate(d.getDate() - 7);
            const startDate = d.toISOString().split('T')[0];
            const DONKI_FLR_URL = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&api_key=${NASA_API_KEY}`;

            const [cmeRes, flrRes] = await Promise.all([
                axios.get(DONKI_CME_URL),
                axios.get(DONKI_FLR_URL)
            ]);

            await redisClient.setex('solar:donki:cme', 1200, JSON.stringify(cmeRes.data));
            await redisClient.setex('solar:donki:flares', 1200, JSON.stringify(flrRes.data));

            logger.info(`✅ [CRON] DONKI CME & Flare Data cached.`);
        } catch (error) {
            logger.error('❌ [CRON] Failed to fetch NASA DONKI data:', error);
        }
    });

    // Execute once immediately on startup
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const startDate = d.toISOString().split('T')[0];
    const DONKI_FLR_URL = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&api_key=${NASA_API_KEY}`;

    logger.info('🚀 [INIT] Bootstrapping initial NASA DONKI data...');
    Promise.all([
        axios.get(DONKI_CME_URL),
        axios.get(DONKI_FLR_URL)
    ]).then(async ([cmeRes, flrRes]) => {
        await redisClient.setex('solar:donki:cme', 1200, JSON.stringify(cmeRes.data));
        await redisClient.setex('solar:donki:flares', 1200, JSON.stringify(flrRes.data));
        logger.info(`✅ [INIT] DONKI Bootstrap complete.`);
    }).catch(err => logger.error("Failed to bootstrap DONKI", err));
};
