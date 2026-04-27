import express from 'express';
import axios from 'axios';
import { getKakshaIntelligence } from '../services/kakshaEngine';
import { fetchTLEData } from '../services/celestrakService';
import { prisma } from '../index';
import logger from '../utils/logger';

const router = express.Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/orbital/current
 * Returns the latest Kaksha Intelligence Object (score + top threats)
 */
router.get('/current', async (req: express.Request, res: express.Response) => {
    try {
        const data = await getKakshaIntelligence();
        res.json(data);
    } catch (error) {
        logger.error('Error fetching Kaksha intelligence:', error);
        res.status(500).json({ error: 'Failed to fetch Kaksha intelligence' });
    }
});

/**
 * POST /api/orbital/sync/tle
 * Manually trigger CelesTrak TLE refresh
 */
router.post('/sync/tle', async (req: express.Request, res: express.Response) => {
    try {
        const sats = await fetchTLEData();
        res.json({ message: 'TLE sync complete', count: sats.length });
    } catch (error) {
        logger.error('Error syncing TLE data:', error);
        res.status(500).json({ error: 'Failed to sync TLE data' });
    }
});

/**
 * GET /api/orbital/satellites
 * Returns all tracked satellites (paginated)
 */
router.get('/satellites', async (req: express.Request, res: express.Response) => {
    try {
        const page   = parseInt(req.query.page as string) || 1;
        const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const type   = req.query.type as string | undefined;

        const where = type ? { type } : {};
        const [total, sats] = await Promise.all([
            prisma.satellite.count({ where }),
            prisma.satellite.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: { id: true, noradId: true, name: true, type: true, epoch: true }
            })
        ]);

        res.json({ total, page, limit, satellites: sats });
    } catch (error) {
        logger.error('Error fetching satellites:', error);
        res.status(500).json({ error: 'Failed to fetch satellites' });
    }
});

/**
 * POST /api/orbital/propagate
 * Propagate a TLE to current positions via Python SGP4 service
 */
router.post('/propagate', async (req: express.Request, res: express.Response) => {
    try {
        const { tle1, tle2, timestamp } = req.body;
        if (!tle1 || !tle2) {
            return res.status(400).json({ error: 'tle1 and tle2 are required' });
        }
        const resp = await axios.post(`${PYTHON_SERVICE_URL}/propagate`, { tle1, tle2, timestamp }, { timeout: 10000 });
        res.json(resp.data);
    } catch (error: any) {
        logger.error('Propagation error:', error.message);
        res.status(500).json({ error: 'Propagation failed' });
    }
});

/**
 * GET /api/orbital/propagate/batch
 * Propagate all tracked satellites to current positions
 */
router.get('/propagate/batch', async (req: express.Request, res: express.Response) => {
    try {
        const sats = await prisma.satellite.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100,
            select: { name: true, tle1: true, tle2: true }
        });

        if (sats.length === 0) {
            return res.json({ count: 0, satellites: [] });
        }

        const resp = await axios.post(
            `${PYTHON_SERVICE_URL}/propagate/batch`,
            { satellites: sats },
            { timeout: 30000 }
        );
        res.json(resp.data);
    } catch (error: any) {
        logger.error('Batch propagation error:', error.message);
        res.status(500).json({ error: 'Batch propagation failed' });
    }
});

/**
 * GET /api/orbital/conjunction
 * Get all conjunction events from the last 24h
 */
router.get('/conjunction', async (req: express.Request, res: express.Response) => {
    try {
        const since = new Date(Date.now() - 86400000);
        const events = await prisma.conjunctionEvent.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { minDistance: 'asc' },
            take: 50,
            include: {
                primarySat: { select: { name: true, noradId: true } }
            }
        });
        res.json(events);
    } catch (error) {
        logger.error('Error fetching conjunctions:', error);
        res.status(500).json({ error: 'Failed to fetch conjunction events' });
    }
});

/**
 * GET /api/orbital/history/score
 * Historical Kaksha scores
 */
router.get('/history/score', async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 24;
        const data = await prisma.kakshaIntelligence.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            select: { score: true, alertLevel: true, trackedSats: true, timestamp: true }
        });
        res.json(data.reverse());
    } catch (error) {
        logger.error('Error fetching Kaksha history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

export default router;
