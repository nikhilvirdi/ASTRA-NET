import { prisma } from '../index';
import redis from '../lib/redis';
import logger from '../utils/logger';

export interface BhumiObject {
    score: number;
    alertLevel: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
    fireCount: number;
    floodRisk: number;       // max rolling 7-day rainfall (mm)
    floodAnomaly: number;    // max rainfall anomaly vs normal (mm)
    tempPeak: number;        // LST peak (°C) — approximate until MODIS connected
    ndviStress: number;      // NDVI stress index (negative = vegetation stress)
    criticalDistricts: number;
    activeHazards: string[];
    hotspots: any[];
    floods: any[];
    timestamp: string;
}

/**
 * Calculates the current Bhumi Score (0-100) based on active Earth hazards.
 * Weights: Fire (35%) + Flood (40%) + Heat/NDVI (25%)
 * Compound multiplier if 2+ domains are simultaneously critical.
 */
export async function getBhumiIntelligence(): Promise<BhumiObject> {
    try {
        const cacheKey = 'earth:intelligence:latest';
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // 1. Fetch latest snapshots from DB
        const fires = await prisma.fireHotspot.findMany({
            orderBy: { timestamp: 'desc' },
            take: 2000
        });

        const floods = await prisma.floodEvent.findMany({
            orderBy: { timestamp: 'desc' },
            take: 20
        });

        // 2. Fire metrics
        const fireCount = fires.length;
        // High-confidence fires only for weighted scoring
        const highConfFires = fires.filter((f: any) => f.confidence === 'h' || f.confidence === 'n').length;

        // 3. Flood metrics
        let maxRain = 0;
        let maxAnomaly = 0;
        let criticalDistricts = 0;
        const floodHazards: string[] = [];

        floods.forEach((f: any) => {
            if (f.rainfall > maxRain) maxRain = f.rainfall;
            if ((f.rainfallAnomaly ?? 0) > maxAnomaly) maxAnomaly = f.rainfallAnomaly ?? 0;
            if (f.severity === 'CRIT') {
                criticalDistricts++;
                floodHazards.push(`FLOOD · ${f.district}, ${f.state}`);
            }
        });

        // 4. Temperature / NDVI
        // Transitioned from seasonal randomization to reactive calculation based on active fire hotspots
        const baseTemp = 28;
        const tempPeak = baseTemp + Math.min(highConfFires / 10, 18); // Max 46°C

        const baseNdvi = -0.05;
        const ndviStress = baseNdvi - Math.min(highConfFires / 500, 0.25); // Max stress -0.30

        // 5. UTS Scoring
        // Fire sub-score: every 100 high-confidence hotspots = ~5 pts, max 35
        let fireScore = Math.min((highConfFires / 700) * 35, 35);

        // Flood sub-score: 300mm weekly = 40 pts, max 40
        let floodScore = Math.min((maxRain / 300) * 40, 40);

        // Heat sub-score: temp above 40°C adds up to 25 pts
        let heatScore = 0;
        if (tempPeak > 40) heatScore = Math.min(((tempPeak - 40) / 8) * 25, 25);

        let score = fireScore + floodScore + heatScore;

        // Compound multiplier: fire AND flood simultaneously → 1.18x
        if (highConfFires > 300 && maxRain > 150) score *= 1.18;
        score = Math.min(Math.round(score), 100);

        // 6. Alert level
        let alertLevel: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL' = 'NORMAL';
        if (score >= 85) alertLevel = 'CRITICAL';
        else if (score >= 65) alertLevel = 'WARNING';
        else if (score >= 40) alertLevel = 'ADVISORY';

        // 7. Active hazards list
        const activeHazards: string[] = [];
        if (highConfFires > 200) activeHazards.push(`WILDFIRE · ${fireCount} hotspots active`);
        if (maxRain > 100)       activeHazards.push(`FLOOD · ${criticalDistricts} critical districts`);
        if (tempPeak > 43) activeHazards.push(`HEATWAVE · ${tempPeak.toFixed(1)}°C LST peak`);
        activeHazards.push(...floodHazards);

        const intObj: BhumiObject = {
            score,
            alertLevel,
            fireCount,
            floodRisk: parseFloat(maxRain.toFixed(1)),
            floodAnomaly: parseFloat(maxAnomaly.toFixed(1)),
            tempPeak: parseFloat(tempPeak.toFixed(1)),
            ndviStress: parseFloat(ndviStress.toFixed(2)),
            criticalDistricts,
            activeHazards,
            hotspots: fires.slice(0, 500),   // send max 500 points to frontend
            floods,
            timestamp: new Date().toISOString()
        };

        // 8. Persist to TimescaleDB
        await prisma.bhumiIntelligence.create({
            data: {
                score,
                fireCount,
                floodRisk: intObj.floodRisk,
                tempPeak: intObj.tempPeak,
                ndviStress: intObj.ndviStress,
                alertLevel
            }
        });

        // 9. Cache for 60 seconds (fresh enough for WebSocket)
        await redis.setex(cacheKey, 60, JSON.stringify(intObj));

        return intObj;

    } catch (error: any) {
        logger.error('Error calculating Bhumi Intelligence:', error.message);
        throw error;
    }
}
