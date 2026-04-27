import axios from 'axios';
import { prisma } from '../index';
import redis from '../lib/redis';
import logger from '../utils/logger';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export interface KakshaObject {
    score: number;
    alertLevel: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
    trackedSats: number;
    criticalConjunctions: number;
    highConjunctions: number;
    debrisIndex: number;
    reentryAlert: boolean;
    topThreats: { primary: string; secondary: string; distance_km: number; risk: string }[];
    satellites: any[];
    timestamp: string;
}

/**
 * Calculate the Kaksha UTS Score (0-100) based on orbital hazard data.
 * Weights: Conjunction Risk (50%) + Debris Density (30%) + Re-entry Alert (20%)
 */
export async function getKakshaIntelligence(): Promise<KakshaObject> {
    try {
        const cacheKey = 'orbital:intelligence:latest';
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // 1. Get tracked satellites from DB
        const satellites = await prisma.satellite.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100
        });

        const trackedSats = satellites.length;

        // 2. Get latest conjunction events from DB (last 24 hours)
        const since = new Date(Date.now() - 86400000);
        const conjunctions = await prisma.conjunctionEvent.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { minDistance: 'asc' },
            take: 50
        });

        const criticalConjunctions = conjunctions.filter((c: any) => c.riskLevel === 'CRITICAL').length;
        const highConjunctions = conjunctions.filter((c: any) => c.riskLevel === 'HIGH').length;

        // 3. If we have fresh TLEs, run conjunction check via Python service
        let pythonConjunctions: any[] = [];
        if (satellites.length >= 2) {
            try {
                const payload = {
                    satellites: satellites.slice(0, 100).map(s => ({
                        name: s.name,
                        tle1: s.tle1,
                        tle2: s.tle2
                    })),
                    threshold_km: 10.0
                };
                const resp = await axios.post(`${PYTHON_SERVICE_URL}/conjunction`, payload, { timeout: 30000 });
                pythonConjunctions = resp.data.conjunctions ?? [];

                // Persist new conjunction events to DB
                const toInsert = pythonConjunctions.slice(0, 20).map((c: any) => {
                    const primarySat = satellites.find(s => s.name === c.primary);
                    return {
                        primarySatId:    primarySat?.id ?? satellites[0].id,
                        secondarySatName: c.secondary,
                        minDistance:     c.distance_km,
                        tca:             new Date(),
                        probability:     c.probability,
                        riskLevel:       c.risk,
                        timestamp:       new Date()
                    };
                });
                if (toInsert.length > 0) {
                    await prisma.conjunctionEvent.createMany({ data: toInsert, skipDuplicates: true });
                }
            } catch (e: any) {
                logger.warn(`Python orbit service unavailable: ${e.message}`);
            }
        }

        // Merge DB + Python conjunctions for scoring
        const allCritical = criticalConjunctions + pythonConjunctions.filter((c: any) => c.risk === 'CRITICAL').length;
        const allHigh = highConjunctions + pythonConjunctions.filter((c: any) => c.risk === 'HIGH').length;

        // 4. Debris index: rough estimate based on tracked object count and type
        // The more debris objects, the higher the LEO congestion index
        const debrisObjects = satellites.filter(s => s.type === 'DEBRIS').length;
        const debrisIndex = Math.min(debrisObjects / trackedSats, 1.0);

        // 5. Re-entry alert: any satellite below 200km altitude is "re-entering soon"
        // We'd need ephemeris to compute this properly, use a placeholder
        const reentryAlert = false; // Will be populated once Python service propagates all

        // 6. UTS Scoring
        // Conjunction risk (0-50): each critical = 20pts, each high = 8pts, capped at 50
        let conjScore = Math.min(allCritical * 20 + allHigh * 8, 50);

        // Debris density (0-30): 0.5 index = 30 pts
        let debrisScore = Math.min(debrisIndex * 60, 30);

        // Tracked sat count normalization (0-20): more objects = higher awareness baseline
        let awarenessScore = Math.min((trackedSats / 200) * 20, 20);

        let score = Math.round(Math.min(conjScore + debrisScore + awarenessScore, 100));

        // 7. Alert level
        let alertLevel: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL' = 'NORMAL';
        if (score >= 80) alertLevel = 'CRITICAL';
        else if (score >= 60) alertLevel = 'WARNING';
        else if (score >= 35) alertLevel = 'ADVISORY';

        const topThreats = pythonConjunctions.slice(0, 5).map((c: any) => ({
            primary: c.primary,
            secondary: c.secondary,
            distance_km: c.distance_km,
            risk: c.risk
        }));

        const result: KakshaObject = {
            score,
            alertLevel,
            trackedSats,
            criticalConjunctions: allCritical,
            highConjunctions: allHigh,
            debrisIndex: parseFloat(debrisIndex.toFixed(3)),
            reentryAlert,
            topThreats,
            satellites: satellites.slice(0, 50),
            timestamp: new Date().toISOString()
        };

        // 8. Persist intelligence snapshot
        await prisma.kakshaIntelligence.create({
            data: {
                score,
                trackedSats,
                criticalConjunctions: allCritical,
                debrisIndex,
                reentryAlert,
                alertLevel
            }
        });

        await redis.setex(cacheKey, 60, JSON.stringify(result));
        return result;

    } catch (error: any) {
        logger.error('Error calculating Kaksha Intelligence:', error.message);
        throw error;
    }
}
