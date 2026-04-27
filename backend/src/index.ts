import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// ─────────────────────────────────────────────────────────────────
//  GLOBAL DB CONNECTION
// ─────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────
//  IMPORTS (after prisma export so services can import it)
// ─────────────────────────────────────────────────────────────────
import './lib/redis';
import { initSocket, getIo } from './lib/socket';
import logger from './utils/logger';

import { startDonkiCron } from './services/donkiService';
import { startNoaaCron } from './services/noaaService';
import { getAdityaIntelligence } from './services/adityaEngine';

import { fetchFireHotspots } from './services/firmsService';
import { fetchRainfallData } from './services/gpmService';
import { getBhumiIntelligence } from './services/bhumiEngine';

import { fetchTLEData } from './services/celestrakService';
import { getKakshaIntelligence } from './services/kakshaEngine';

import solarRoutes from './routes/solarRoutes';
import earthRoutes from './routes/earthRoutes';
import kakshaRoutes from './routes/kakshaRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import { getMasterIntelligence } from './services/masterEngine';

// ─────────────────────────────────────────────────────────────────
//  EXPRESS + SOCKET.IO SETUP
// ─────────────────────────────────────────────────────────────────
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

initSocket(server);

app.use(cors());
app.use(express.json());

app.use('/api/solar',        solarRoutes);
app.use('/api/earth',        earthRoutes);
app.use('/api/orbital',      kakshaRoutes);
app.use('/api/intelligence', intelligenceRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'astra-net-backend', modules: ['solar', 'earth', 'orbital'] });
});

// ─────────────────────────────────────────────────────────────────
//  BROADCAST HELPERS
// ─────────────────────────────────────────────────────────────────
async function broadcastSolar() {
    try {
        const payload = await getAdityaIntelligence();
        if (payload) getIo()?.emit('solar:update', payload);
    } catch (e) { logger.error('Solar broadcast failed', e); }
}

async function broadcastBhumi() {
    try {
        const payload = await getBhumiIntelligence();
        getIo()?.emit('earth:update', payload);
    } catch (e) { logger.error('Bhumi broadcast failed', e); }
}

async function broadcastKaksha() {
    try {
        const payload = await getKakshaIntelligence();
        getIo()?.emit('orbital:update', payload);
    } catch (e) { logger.error('Kaksha broadcast failed', e); }
}

// ─────────────────────────────────────────────────────────────────
//  ASTRA-ADITYA (SOLAR) CRONS — already managed by services
// ─────────────────────────────────────────────────────────────────
function startAdityaCrons() {
    startDonkiCron();
    startNoaaCron();
    // Emit intelligence every minute
    cron.schedule('* * * * *', broadcastSolar);
}

// ─────────────────────────────────────────────────────────────────
//  ASTRA-BHUMI (EARTH) CRONS
// ─────────────────────────────────────────────────────────────────
function startBhumiCrons() {
    // Fire hotspots: every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        logger.info('⏳ FIRMS fire sync...');
        await fetchFireHotspots();
        await broadcastBhumi();
    });

    // Flood / rainfall: every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('⏳ GPM rain sync...');
        await fetchRainfallData();
        await broadcastBhumi();
    });

    // Intelligence broadcast every minute (keep clients live)
    cron.schedule('* * * * *', broadcastBhumi);
}

// ─────────────────────────────────────────────────────────────────
//  ASTRA-KAKSHA (ORBITAL) CRONS
// ─────────────────────────────────────────────────────────────────
function startKakshaCrons() {
    // TLE refresh every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        logger.info('⏳ CelesTrak TLE refresh...');
        await fetchTLEData();
        await broadcastKaksha();
    });

    // Conjunction check + intelligence every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        logger.info('⏳ Kaksha conjunction check...');
        await broadcastKaksha();
    });

    // Intelligence broadcast every minute
    cron.schedule('* * * * *', broadcastKaksha);
}

// ─────────────────────────────────────────────────────────────────
//  PHASE 4: MASTER INTELLIGENCE LAYER CRON
// ─────────────────────────────────────────────────────────────────
function startIntelligenceCrons() {
    // Master score re-calculated every minute (all 3 cached sub-scores are inputs)
    cron.schedule('* * * * *', async () => {
        try {
            await getMasterIntelligence();
        } catch (e) { logger.error('Master intelligence cron failed', e); }
    });
}

// ─────────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
    logger.info(`🚀 ASTRA-NET Backend running on port ${PORT}`);

    // Start all cron jobs
    startAdityaCrons();
    startBhumiCrons();
    startKakshaCrons();
    startIntelligenceCrons();

    // Initial data fetches on boot (populate DB immediately)
    logger.info('Running boot-time data sync for all modules...');

    // Phase 1 - Solar: handled by startDonkiCron / startNoaaCron internally
    // Phase 2 - Earth
    fetchFireHotspots().catch(e => logger.error('Boot FIRMS failed:', e.message));
    fetchRainfallData().catch(e => logger.error('Boot GPM failed:', e.message));

    // Phase 3 - Orbital
    fetchTLEData().catch(e => logger.error('Boot TLE failed:', e.message));

    logger.info('✅ All modules initialized.');
});
