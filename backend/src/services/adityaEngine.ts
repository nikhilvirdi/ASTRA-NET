import redisClient from '../lib/redis';
import { getIo } from '../lib/socket';
import logger from '../utils/logger';

function getKpScore(kp: number): number {
    if (kp < 1) return 0;
    if (kp <= 2) return 5;
    if (kp <= 3) return 12;
    if (kp <= 4) return 20;
    if (kp <= 5) return 30;
    if (kp <= 6) return 45;
    if (kp <= 7) return 60;
    if (kp <= 8) return 75;
    return 90;
}

function getStormLevel(kp: number): string {
    if (kp >= 9) return 'G5';
    if (kp >= 8) return 'G4';
    if (kp >= 7) return 'G3';
    if (kp >= 6) return 'G2';
    if (kp >= 5) return 'G1';
    return 'NOMINAL';
}

function getFlareScore(flares: any[]): number {
    if (!flares || flares.length === 0) return 0;
    // Just grab the peak flare class from the last 24h
    // Since NASA orders descending usually, or we can just pick the last one
    const latest = flares[flares.length - 1];
    if (!latest || !latest.classType) return 0;
    if (latest.classType.startsWith('X')) return 20;
    if (latest.classType.startsWith('M')) return 10;
    if (latest.classType.startsWith('C')) return 3;
    return 0;
}

export const getAdityaIntelligence = async () => {
    try {
        let score = 0;
        let kp = 0;
        let windSpeed = 0;
        let bz = 0;
        let cmeStatus = 'CLEAR';
        let cmeArrivalHours = -1;
        let flareAlert = false;
        let highestFlareClass = 'A';
        let gpsImpact = 'NOMINAL';
        let recentFlares: any[] = [];

        // Fetch metrics
        const kpDataStr = await redisClient.get('solar:noaa:kp');
        const windDataStr = await redisClient.get('solar:noaa:wind');
        const bzDataStr = await redisClient.get('solar:noaa:bz');
        const cmeDataStr = await redisClient.get('solar:donki:cme');
        const flrDataStr = await redisClient.get('solar:donki:flares');

        // Parse Kp
        if (kpDataStr) {
            const arr = JSON.parse(kpDataStr);
            if (arr.length > 1) {
                kp = parseFloat(arr[arr.length - 1][1]);
                score += getKpScore(kp);
                if (kp > 4) gpsImpact = 'DEGRADED';
                if (kp > 6) gpsImpact = 'IMPACT';
            }
        }

        // Parse Wind
        if (windDataStr) {
            const arr = JSON.parse(windDataStr);
            if (arr.length > 1) {
                windSpeed = parseFloat(arr[arr.length - 1][2]);
            }
        }

        // Parse Bz
        if (bzDataStr) {
            const arr = JSON.parse(bzDataStr);
            if (arr.length > 1) {
                bz = parseFloat(arr[arr.length - 1][3]);
            }
        }

        // Parse CME
        if (cmeDataStr) {
            const arr = JSON.parse(cmeDataStr);
            if (arr && arr.length > 0) {
                score += 15; // Active CME
                cmeStatus = 'WARNING';
                cmeArrivalHours = 28; // Basic mock estimation
            }
        }

        // Parse Flares
        if (flrDataStr) {
            const flrRaw = JSON.parse(flrDataStr);
            if (flrRaw && flrRaw.length > 0) {
                recentFlares = flrRaw.map((f: any) => ({
                    flrID: f.flrID,
                    classType: f.classType,
                    region: f.activeRegionNum ? f.activeRegionNum.toString() : 'Unknown',
                    timestamp: f.beginTime
                }));

                score += getFlareScore(recentFlares);

                const latestFlare = recentFlares[recentFlares.length - 1];
                if (latestFlare) {
                    highestFlareClass = latestFlare.classType;
                    if (highestFlareClass.startsWith('M') || highestFlareClass.startsWith('X')) {
                        flareAlert = true;
                    }
                }
            }
        }

        const adityaScore = Math.min(score, 100);

        const payload = {
            adityaScore,
            kp,
            stormLevel: getStormLevel(kp),
            flareAlert,
            highestFlareClass,
            cmeStatus,
            cmeArrivalHours,
            gpsImpact,
            windSpeed,
            bz,
            recentFlares,
            timestamp: new Date().toISOString()
        };

        // Cache the latest intelligence
        await redisClient.setex('solar:intelligence:latest', 60, JSON.stringify(payload));

        try {
            getIo().to('solar').emit('solar:update', payload);
        } catch (e) {
            // Socket might not be ready yet
        }

        return payload;

    } catch (e) {
        logger.error('Error generating intelligence payload:', e);
        return null;
    }
}
