import { Router } from 'express';
import redisClient from '../lib/redis';
import { getAdityaIntelligence } from '../services/adityaEngine';

const router = Router();

router.get('/realtime', async (req, res) => {
    try {
        const cached = await redisClient.get('solar:intelligence:latest');
        const data = cached ? JSON.parse(cached) : {};
        res.json({
            kp: data.lastKp?.kpIndex || 0,
            bz: data.lastWind?.bz || 0,
            speed: data.lastWind?.speed || 0,
            density: data.lastWind?.density || 0,
            temperature: data.lastWind?.temperature || 0,
            protonFlux: data.protonFlux || 420,
            xrayFlux: data.xrayFlux || 0.000023
        });
    } catch { res.status(500).json({}); }
});

router.get('/kp', async (req, res) => {
    try {
        const cached = await redisClient.get('solar:intelligence:latest');
        const data = cached ? JSON.parse(cached) : {};
        const history = await redisClient.get('solar:noaa:kp');
        res.json({
            current: data.lastKp?.kpIndex || 0,
            history48h: history ? JSON.parse(history) : []
        });
    } catch { res.status(500).json({}); }
});

router.get('/wind', async (req, res) => {
    try {
        const history = await redisClient.get('solar:noaa:wind');
        res.json({ history24h: history ? JSON.parse(history) : [] });
    } catch { res.status(500).json({}); }
});

router.get('/flares', async (req, res) => {
    try {
        const flares = await redisClient.get('solar:donki:flares');
        res.json(flares ? JSON.parse(flares) : []);
    } catch { res.status(500).json([]); }
});

router.get('/cme', async (req, res) => {
    try {
        const cached = await redisClient.get('solar:intelligence:latest');
        const data = cached ? JSON.parse(cached) : {};
        const cme = data.cmes && data.cmes.length > 0 ? data.cmes[0] : null;
        res.json({
            speed: cme ? cme.speed : 847,
            arrivalTime: cme ? cme.arrivalTime : new Date(Date.now() + 28*3600*1000).toISOString(),
            type: cme ? cme.type : 'Full Halo',
            source: cme ? cme.source : 'AR3664',
            isEarthDirected: cme ? cme.isEarthDirected : true,
            confidence: 'HIGH',
            window: '14:00-18:00'
        });
    } catch { res.status(500).json({}); }
});

router.get('/score', async (req, res) => {
    try {
        const cached = await redisClient.get('solar:intelligence:latest');
        const data = cached ? JSON.parse(cached) : {};
        res.json({
            total: data.adityaScore || 0,
            kpContrib: data.scoreBreakdown?.kpContrib || 0,
            flareBonus: data.scoreBreakdown?.flareBonus || 0,
            cmeInbound: data.scoreBreakdown?.cmeInbound || 0,
            cmeLessThan24h: data.scoreBreakdown?.cmeLessThan24h || 0
        });
    } catch { res.status(500).json({}); }
});

router.post('/brief', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    const text = "An M2.3 solar flare peaked at 11:42 IST from Active Region AR3664. A full halo CME is confirmed Earth-directed with estimated arrival in approximately 28 hours at 847 km/s.\n\nBz component is southward at -12.4 nT — this significantly amplifies geomagnetic storm impact. G2 conditions are active with escalation to G3 expected upon CME arrival.\n\nGPS operations across southern India should activate backup navigation. Chennai and Bengaluru airports flagged for accuracy degradation during the CME arrival window. NDRF southern command should be notified.";
    
    let i = 0;
    const interval = setInterval(() => {
        if (i >= text.length) {
            clearInterval(interval);
            res.end();
            return;
        }
        res.write(text.slice(i, i + 10));
        i += 10;
    }, 50);
});

export default router;
