// Remove bad react import
import express from 'express';
import { getBhumiIntelligence } from '../services/bhumiEngine';
import { fetchFireHotspots } from '../services/firmsService';
import { fetchRainfallData } from '../services/gpmService';
import logger from '../utils/logger';
import { prisma } from '../index';

const router = express.Router();

// Get the compiled Earth Intelligence Object (Score + active hazards)
router.get('/current', async (req: express.Request, res: express.Response) => {
    try {
        const data = await getBhumiIntelligence();
        res.json(data);
    } catch (error) {
        logger.error("Error fetching Bhumi intelligence:", error);
        res.status(500).json({ error: "Failed to fetch Bhumi intelligence" });
    }
});

// Manual trigger to pull latest NASA FIRMS data
router.post('/sync/fires', async (req: express.Request, res: express.Response) => {
    try {
        const fires = await fetchFireHotspots();
        res.json({ message: "FIRMS sync complete", count: fires.length });
    } catch (error) {
        logger.error("Error syncing FIRMS data:", error);
        res.status(500).json({ error: "Failed to sync FIRMS data" });
    }
});

// Manual trigger to pull latest GPM Flood grid
router.post('/sync/floods', async (req: express.Request, res: express.Response) => {
    try {
        const floods = await fetchRainfallData();
        res.json({ message: "GPM sync complete", count: floods.length });
    } catch (error) {
        logger.error("Error syncing GPM data:", error);
        res.status(500).json({ error: "Failed to sync GPM data" });
    }
});

// Get historical scores (for chart)
router.get('/history/score', async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 24; // last 24 records
        const data = await prisma.bhumiIntelligence.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            select: { score: true, timestamp: true }
        });
        res.json(data.reverse()); // Chronological order
    } catch (error) {
        logger.error("Error fetching Phase 2 history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

export default router;
