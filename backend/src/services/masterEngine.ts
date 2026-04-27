import redis from '../lib/redis';
import { getIo } from '../lib/socket';
import logger from '../utils/logger';

export interface MasterIntelligence {
    masterScore: number;         // 0-100 overall planetary threat score
    alertLevel: 'NOMINAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL' | 'EXTREME';
    adityaScore: number;         // Solar sub-score (weight: 0.35)
    bhumiScore: number;          // Earth sub-score (weight: 0.40)
    kakshaScore: number;         // Orbital sub-score (weight: 0.25)
    cascadeMultiplier: number;   // Compound threat amplifier
    correlations: Correlation[];
    summary: string;
    timestamp: string;
}

export interface Correlation {
    id: string;
    domains: string[];
    scenario: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: string;
}

/**
 * Calculate the Master UTS Score by combining all 3 domain sub-scores.
 * Weights: Bhumi × 0.40 + Aditya × 0.35 + Kaksha × 0.25
 * Cascade Multiplier: 1.0 → 1.5 based on how many domains are simultaneously elevated
 */
export async function getMasterIntelligence(): Promise<MasterIntelligence> {
    try {
        const cacheKey = 'intelligence:master:latest';
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Fetch individual module scores from Redis cache
        const [adityaRaw, bhumiRaw, kakshaRaw] = await Promise.all([
            redis.get('solar:intelligence:latest'),
            redis.get('earth:intelligence:latest'),
            redis.get('orbital:intelligence:latest'),
        ]);

        const aditya = adityaRaw ? JSON.parse(adityaRaw) : null;
        const bhumi  = bhumiRaw  ? JSON.parse(bhumiRaw)  : null;
        const kaksha = kakshaRaw ? JSON.parse(kakshaRaw) : null;

        const adityaScore = aditya?.adityaScore ?? 0;
        const bhumiScore  = bhumi?.score         ?? 0;
        const kakshaScore = kaksha?.score         ?? 0;

        // Weighted sum (before cascade multiplier)
        let baseScore = (adityaScore * 0.35) + (bhumiScore * 0.40) + (kakshaScore * 0.25);

        // ── Cascade Multiplier ────────────────────────────────────────
        // Count how many domains are elevated above WARNING threshold
        const WARN_THRESH = 65;
        const elevatedDomains = [adityaScore, bhumiScore, kakshaScore].filter(s => s >= WARN_THRESH).length;

        let cascadeMultiplier = 1.0;
        if (elevatedDomains === 2) cascadeMultiplier = 1.25;
        if (elevatedDomains === 3) cascadeMultiplier = 1.50;

        // Apply compound threat amplifier
        let masterScore = Math.min(Math.round(baseScore * cascadeMultiplier), 100);

        // ── Alert Level ────────────────────────────────────────────────
        let alertLevel: MasterIntelligence['alertLevel'] = 'NOMINAL';
        if (masterScore >= 90)      alertLevel = 'EXTREME';
        else if (masterScore >= 75) alertLevel = 'CRITICAL';
        else if (masterScore >= 60) alertLevel = 'WARNING';
        else if (masterScore >= 35) alertLevel = 'ADVISORY';

        // ── Cross-Domain Correlations ──────────────────────────────────
        const correlations: Correlation[] = [];

        // Scenario 1: Solar CME + Orbital GPS impact
        if (aditya?.cmeStatus === 'WARNING' && kaksha?.trackedSats > 0) {
            correlations.push({
                id: 'CME_GPS_DEGRADATION',
                domains: ['SOLAR', 'ORBITAL'],
                scenario: 'CME → GPS Degradation',
                severity: 'HIGH',
                details: `Active CME (ETA ${aditya.cmeArrivalHours}h) will degrade GPS accuracy, increasing orbital conjunction risk. SFCOF coordination recommended.`
            });
        }

        // Scenario 2: Earth flood + Solar CME blocks relief comms
        if (bhumi?.alertLevel === 'CRITICAL' && aditya?.cmeStatus === 'WARNING') {
            correlations.push({
                id: 'FLOOD_CME_COMMS_BLACKOUT',
                domains: ['EARTH', 'SOLAR'],
                scenario: 'Flood + CME → Relief Comms Blackout',
                severity: 'CRITICAL',
                details: `Ongoing flood disaster in ${bhumi.criticalDistricts ?? '?'} critical districts coincides with CME arrival. HF/satellite communications for NDRF at risk within 28 hours.`
            });
        }

        // Scenario 3: Fire + heatwave compound
        if (bhumi?.fireCount > 500 && adityaScore > 40) {
            correlations.push({
                id: 'FIRE_HEATWAVE_COMPOUND',
                domains: ['EARTH', 'SOLAR'],
                scenario: 'Wildfire × Solar Heat Compound',
                severity: adityaScore > 60 ? 'HIGH' : 'MEDIUM',
                details: `${bhumi.fireCount} active fire hotspots coincide with elevated Kp=${aditya?.kp?.toFixed(1) ?? '?'} solar heating. Combined LST peak of ${bhumi.tempPeak ?? '?'}°C accelerating drought conditions.`
            });
        }

        // Scenario 4: Orbital debris + satellite outage risk during disaster
        if (kaksha?.criticalConjunctions > 0 && (bhumi?.alertLevel === 'WARNING' || bhumi?.alertLevel === 'CRITICAL')) {
            correlations.push({
                id: 'DEBRIS_SAT_OUTAGE',
                domains: ['ORBITAL', 'EARTH'],
                scenario: 'Orbital Conjunction + Disaster Monitoring Gap',
                severity: 'HIGH',
                details: `${kaksha.criticalConjunctions} critical conjunction event(s) threaten satellite coverage during ongoing Earth hazard response. Backup imaging assets should be queued.`
            });
        }

        // Scenario 5: Triple threat
        if (elevatedDomains === 3) {
            correlations.push({
                id: 'TRIPLE_THREAT',
                domains: ['SOLAR', 'EARTH', 'ORBITAL'],
                scenario: 'Category 3 Compound Event — All Domains Elevated',
                severity: 'CRITICAL',
                details: `All three threat domains (Solar, Earth, Orbital) are simultaneously at WARNING or above. Cascade probability: HIGH. Unified emergency response escalation recommended.`
            });
        }

        // ── Summary ────────────────────────────────────────────────────
        const summary = generateSummary(masterScore, alertLevel, adityaScore, bhumiScore, kakshaScore, correlations);

        const result: MasterIntelligence = {
            masterScore,
            alertLevel,
            adityaScore,
            bhumiScore,
            kakshaScore,
            cascadeMultiplier,
            correlations,
            summary,
            timestamp: new Date().toISOString()
        };

        // Cache for 60 seconds
        await redis.setex(cacheKey, 60, JSON.stringify(result));

        // Broadcast
        getIo()?.emit('intelligence:update', result);

        return result;

    } catch (error: any) {
        logger.error('Error calculating Master Intelligence:', error.message);
        throw error;
    }
}

function generateSummary(
    score: number,
    level: string,
    aditya: number,
    bhumi: number,
    kaksha: number,
    correlations: Correlation[]
): string {
    const parts = [];
    parts.push(`ASTRA-NET Master Score: ${score}/100 [${level}]`);
    parts.push(`Solar: ${aditya} · Earth: ${bhumi} · Orbital: ${kaksha}`);
    if (correlations.length > 0) {
        const critCount = correlations.filter(c => c.severity === 'CRITICAL').length;
        parts.push(`${correlations.length} cross-domain correlation(s) detected${critCount > 0 ? ` (${critCount} CRITICAL)` : ''}.`);
    }
    return parts.join(' | ');
}
