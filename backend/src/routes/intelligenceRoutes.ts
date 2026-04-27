import express from 'express';
import { getMasterIntelligence } from '../services/masterEngine';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/intelligence/master
 * Returns the full Master Intelligence Object with all domain scores + correlations
 */
router.get('/master', async (req: express.Request, res: express.Response) => {
    try {
        const data = await getMasterIntelligence();
        res.json(data);
    } catch (error) {
        logger.error('Error fetching master intelligence:', error);
        res.status(500).json({ error: 'Failed to fetch master intelligence' });
    }
});

/**
 * GET /api/intelligence/correlations
 * Returns only the cross-domain correlations from the latest master intelligence
 */
router.get('/correlations', async (req: express.Request, res: express.Response) => {
    try {
        const data = await getMasterIntelligence();
        res.json({
            correlations: data.correlations,
            count: data.correlations.length,
            cascadeMultiplier: data.cascadeMultiplier,
            timestamp: data.timestamp
        });
    } catch (error) {
        logger.error('Error fetching correlations:', error);
        res.status(500).json({ error: 'Failed to fetch correlations' });
    }
});

/**
 * GET /api/intelligence/score
 * Returns just the numeric scores (lightweight endpoint for dashboard widgets)
 */
router.get('/score', async (req: express.Request, res: express.Response) => {
    try {
        const data = await getMasterIntelligence();
        res.json({
            masterScore:       data.masterScore,
            alertLevel:        data.alertLevel,
            adityaScore:       data.adityaScore,
            bhumiScore:        data.bhumiScore,
            kakshaScore:       data.kakshaScore,
            cascadeMultiplier: data.cascadeMultiplier,
            summary:           data.summary,
            timestamp:         data.timestamp
        });
    } catch (error) {
        logger.error('Error fetching score:', error);
        res.status(500).json({ error: 'Failed to fetch score' });
    }
});

export default router;
