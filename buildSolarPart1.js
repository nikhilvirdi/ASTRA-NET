const fs = require('fs');
const path = require('path');

const write = (p, content) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content.trim() + '\n');
};

console.log("Extracting CSS...");
const rawHtml = fs.readFileSync('c:/AstraNET/ASNT-frontend/astra-solar-v2.html', 'utf-8');
const cssMatch = rawHtml.match(/<style>([\s\S]*?)<\/style>/i);
if(cssMatch) {
    write('c:/AstraNET/frontend/src/styles/solar.css', cssMatch[1]);
} else {
    console.error("No CSS found!");
}

console.log("Writing Store...");
write('c:/AstraNET/frontend/src/store/solarStore.ts', `
import { create } from 'zustand';

export interface FlareEvent {
  flrID: string;
  beginTime: string;
  peakTime: string;
  endTime: string | null;
  classType: string;
  sourceLocation: string;
  activeRegionNum: number;
  linkedCMEs: string[];
}

export interface CmeData {
  speed: number;
  arrivalTime: string;
  isEarthDirected: boolean;
  type: string;
  source: string;
  window: string;
  confidence: string;
}

interface SolarState {
  kp: number;
  bz: number;
  speed: number;
  density: number;
  temperature: number;
  protonFlux: number;
  xrayFlux: number;
  adityaScore: number;
  scoreBreakdown: { kpContrib: number, flareBonus: number, cmeInbound: number, cmeLessThan24h: number };
  gScale: string;
  flares: FlareEvent[];
  cme: CmeData | null;
}

export const useSolarStore = create<SolarState>(() => ({
  kp: 0,
  bz: 0,
  speed: 0,
  density: 0,
  temperature: 0,
  protonFlux: 0,
  xrayFlux: 0,
  adityaScore: 0,
  scoreBreakdown: { kpContrib: 0, flareBonus: 0, cmeInbound: 0, cmeLessThan24h: 0 },
  gScale: 'G0',
  flares: [],
  cme: null
}));
`);

console.log("Writing Hooks...");
write('c:/AstraNET/frontend/src/hooks/useKpData.ts', `
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useKpData() {
  return useQuery({
    queryKey: ['kp-index'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/kp').catch(() => ({ data: { current: 0, history48h: [] } }));
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
`);

write('c:/AstraNET/frontend/src/hooks/useSolarRealtime.ts', `
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useSolarRealtime() {
  return useQuery({
    queryKey: ['solar-realtime'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/realtime').catch(() => ({ data: { bz: 0, speed: 0, density: 0, temperature: 0, protonFlux: 0, xrayFlux: 0 } }));
      return res.data;
    },
    refetchInterval: 10_000,
  });
}
`);

write('c:/AstraNET/frontend/src/hooks/useSolarWindChartData.ts', `
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useSolarWindChartData() {
  return useQuery({
    queryKey: ['solar-wind'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/wind').catch(() => ({ data: { history24h: [] } }));
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
`);

write('c:/AstraNET/frontend/src/hooks/useFlareData.ts', `
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useFlareData() {
  return useQuery({
    queryKey: ['flares'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/flares').catch(() => ({ data: [] }));
      return res.data;
    },
    refetchInterval: 15 * 60_000,
  });
}
`);

write('c:/AstraNET/frontend/src/hooks/useCmeData.ts', `
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useCmeData() {
  return useQuery({
    queryKey: ['cme'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/cme').catch(() => ({ data: { arrivalTime: null, speed: 0, isEarthDirected: false, type: 'None', source: 'N/A', confidence: 'LOW', window: 'N/A' } }));
      return res.data;
    },
    refetchInterval: 60 * 60_000,
  });
}
`);

write('c:/AstraNET/frontend/src/hooks/useSolarBrief.ts', `
import { useState, useCallback, useEffect } from 'react';
export function useSolarBrief(score: number) {
  const [brief, setBrief] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchBrief = useCallback(async () => {
    setIsStreaming(true);
    setBrief('');
    try {
      const response = await fetch('http://localhost:3000/api/solar/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      if (!response.ok) throw new Error();
      if(response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            setBrief(prev => prev + decoder.decode(value));
          }
      }
    } catch(e) {
      setBrief("Brief unavailable. Awaiting next cycle.");
    } finally {
      setIsStreaming(false);
    }
  }, [score]);

  useEffect(() => {
    if (score > 0) fetchBrief();
    const interval = setInterval(fetchBrief, 3 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBrief, score]);

  return { brief, isStreaming };
}
`);

console.log("Writing Components...");

write('c:/AstraNET/frontend/src/components/solar/SunHero.tsx', `
export default function SunHero() {
  return (
    <div className="sun-hero">
      <div className="sun-scene">
        <div className="cr cr1"></div>
        <div className="cr cr2"></div>
        <div className="cr cr3"></div>
        <div className="cr cr4"></div>
        <div className="cr-glow"></div>
        <div className="spikes" id="spikes">
          {Array.from({length: 14}).map((_, i) => (
             <div key={i} className="spike" style={{
                 height: 10 + Math.random()*16 + 'px',
                 transform: \`rotate(\${i * (360/14)}deg) translateX(-50%) translateY(-\${28 + 10 + Math.random()*16}px)\`,
                 animationDelay: \`\${Math.random() * 2.5}s\`,
                 animationDuration: \`\${1.6 + Math.random() * 1.8}s\`
             }} />
          ))}
        </div>
        <div className="sun-core"></div>
      </div>
      <div className="sun-region">ACTIVE REGION AR3664</div>
      <div className="sun-class-row">
        <div className="sun-class">M2.3</div>
        <div className="sun-class-lbl">FLARE CLASS</div>
      </div>
      <div className="flare-alert">
        <div className="fa-dot"></div>
        <div className="fa-text">CME EARTH-DIRECTED · ARRIVAL ~28H</div>
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/SensorReadings.tsx', `
import { useSolarRealtime } from '../../hooks/useSolarRealtime';
export default function SensorReadings() {
  const { data } = useSolarRealtime();
  
  return (
    <div className="lsec">
      <div className="lsec-title">LIVE SENSOR READINGS</div>
      <div className="stat" style={{borderColor:'var(--a-border)'}}>
        <div className="stat-lbl">SOLAR WIND</div>
        <div><span className="stat-val">{data?.speed || '--'}</span><span className="stat-unit">km/s</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">Bz COMPONENT</div>
        <div><span className="stat-val" style={{color:'var(--red)'}}>{data?.bz || '--'}</span><span className="stat-unit">nT</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">PROTON FLUX</div>
        <div><span className="stat-val">{data?.protonFlux || '--'}</span><span className="stat-unit">pfu</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">X-RAY FLUX</div>
        <div><span className="stat-val">{data?.xrayFlux || '--'}</span><span className="stat-unit">W/m²</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">CME SPEED</div>
        <div><span className="stat-val">{data?.speed || '--'}</span><span className="stat-unit">km/s</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">DENSITY</div>
        <div><span className="stat-val">{data?.density || '--'}</span><span className="stat-unit">n/cm³</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">TEMPERATURE</div>
        <div><span className="stat-val">{data?.temperature || '--'}</span><span className="stat-unit">K</span></div>
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/InfraImpactList.tsx', `
export default function InfraImpactList() {
  return (
    <div className="lsec">
      <div className="lsec-title">INFRASTRUCTURE IMPACT</div>
      <div className="infra-row"><div className="id r"></div><div className="iname">Chennai Intl Airport</div><div className="itype">AVIATION</div></div>
      <div className="infra-row"><div className="id r"></div><div className="iname">Bengaluru Airport</div><div className="itype">AVIATION</div></div>
      <div className="infra-row"><div className="id r"></div><div className="iname">Southern Grid Node-4</div><div className="itype">POWER</div></div>
      <div className="infra-row"><div className="id o"></div><div className="iname">Hyderabad Airport</div><div className="itype">AVIATION</div></div>
      <div className="infra-row"><div className="id o"></div><div className="iname">BSNL South Hub</div><div className="itype">TELECOM</div></div>
      <div className="infra-row"><div className="id g"></div><div className="iname">Mumbai Airport</div><div className="itype">AVIATION</div></div>
      <div className="infra-row"><div className="id g"></div><div className="iname">Delhi NDRF Command</div><div className="itype">EMERGENCY</div></div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/KpIndexChart.tsx', `
import { useKpData } from '../../hooks/useKpData';
import { BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function KpIndexChart() {
  const { data: kpData } = useKpData();
  const currentKp = kpData?.current ?? 0;

  return (
    <div className="card">
      <div className="clbl">KP INDEX — PLANETARY</div>
      <div className="kp-num">{currentKp.toFixed(1)}</div>
      <div className="kp-sub">NOAA SWPC · REAL-TIME</div>
      
      <div className="kp-scale">
        {Array.from({length: 9}, (_, i) => (
          <div key={i} className={\`ks \${i < Math.floor(currentKp) ? (currentKp >= 6 ? 'warn' : 'on') : ''}\`} />
        ))}
      </div>
      <div className="ks-labels">
        <span>0</span><span>3</span><span>6</span><span>9</span>
      </div>
      
      <div style={{marginTop: '15px'}}>
        <div className="clbl">KP INDEX — 48H HISTORY</div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={kpData?.history48h ?? []} barSize={8} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 9]} />
            <ReferenceLine y={5} stroke="rgba(255,58,58,0.18)" strokeDasharray="4 4" />
            <Bar dataKey="kp" isAnimationActive={false}>
              {(kpData?.history48h ?? []).map((entry: any, i: number) => (
                <Cell key={i} fill={entry.kp >= 6 ? '#ff3a3a' : entry.kp >= 4 ? '#e07520' : 'rgba(224,117,32,0.35)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginTop:'4px'}}>
          <span>-48H</span><span>-36H</span><span>-24H</span><span>-12H</span><span>NOW</span>
        </div>
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/BzChart.tsx', `
import { useSolarRealtime } from '../../hooks/useSolarRealtime';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';

export default function BzChart() {
  const { data } = useSolarRealtime();
  const bz = data?.bz ?? 0;
  
  // Fake bz history for chart (as instructed by prompt context to draw chart but replace real data hooks where applicable)
  const [bzHistory] = useState(() => Array.from({length: 60}, (_, i) => ({ time: i, bz: (Math.random() - 0.5) * 18 + Math.sin(i * 0.32) * 7 - (i > 45 ? 8 : 0) })));

  return (
    <div className="card danger">
      <div className="clbl red">Bz COMPONENT — IMF</div>
      <div className={\`bz-num \${bz < 0 ? 'bz-neg' : 'bz-pos'}\`}>{bz.toFixed(1)}</div>
      <div className="kp-sub" style={{color:'var(--muted)'}}>DSCOVR · nT · {bz < 0 ? 'SOUTHWARD' : 'NORTHWARD'}</div>
      <div className="bz-info">Southward Bz opens Earth's magnetosphere, amplifying storm impact.</div>
      {bz < -5 && <div className="bz-tag">STORM COUPLING ACTIVE</div>}
      
      <div style={{marginTop: '15px'}}>
          <div className="clbl red">Bz COMPONENT — 12H HISTORY (nT)</div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={bzHistory} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[-25, 25]} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
              <Line dataKey="bz" stroke="#ff4040" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginTop:'4px'}}>
            <span>-12H</span><span>-9H</span><span>-6H</span><span>-3H</span><span>NOW</span>
          </div>
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/SolarWindChart.tsx', `
import { useSolarRealtime } from '../../hooks/useSolarRealtime';
import { useSolarWindChartData } from '../../hooks/useSolarWindChartData';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function SolarWindChart() {
  const { data } = useSolarRealtime();
  const { data: chartData } = useSolarWindChartData();
  const speed = data?.speed ?? 0;
  const needlePos = Math.min(100, Math.max(0, ((speed - 300) / 700) * 100));

  return (
    <>
    <div className="card">
      <div className="clbl">SOLAR WIND SPEED</div>
      <div className="sw-num">{Math.round(speed)}</div>
      <div className="kp-sub">NOAA DSCOVR · km/s</div>
      <div style={{marginTop:'10px'}}>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginBottom:'4px'}}>
          <span>QUIET 300</span><span>ELEVATED 500</span><span>STORM 800</span>
        </div>
        <div className="speed-bar">
          <div className="speed-needle" style={{ left: \`\${needlePos}%\` }}></div>
        </div>
      </div>
    </div>
    
    <div className="card card-s">
      <div className="clbl ca">SOLAR WIND SPEED — 24H CONTINUOUS (km/s) · NOAA DSCOVR L1</div>
      <ResponsiveContainer width="100%" height={72}>
        <AreaChart data={chartData?.history24h ?? []} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="swGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07520" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#e07520" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <ReferenceLine y={800} stroke="rgba(255,58,58,0.22)" strokeDasharray="5 4" />
          <Area dataKey="speed" stroke="#e07520" strokeWidth={1.8} fill="url(#swGrad2)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'rgba(255,255,255,0.35)',marginTop:'4px'}}>
        <span>-24H</span><span>-18H</span><span>-12H</span><span>-6H</span><span>NOW</span>
      </div>
    </div>
    </>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/XRayFluxChart.tsx', `
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function XRayFluxChart() {
  const xrData = Array.from({ length: 80 }, (_, i) => {
    let base = 0.2 + Math.random() * 0.3;
    if (i === 65) base += 3.0;
    if (i === 64 || i === 66) base += 1.5;
    if (i === 50) base += 1.0;
    return { time: i, flux: Math.max(0, base + Math.sin(i * 0.2) * 0.15) };
  });

  return (
    <div className="card">
      <div className="clbl">X-RAY FLUX — 6H (W/m²) · GOES-16 · FLARE CLASSIFICATION BANDS</div>
      <ResponsiveContainer width="100%" height={70}>
        <AreaChart data={xrData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="xrGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0a040" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f0a040" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 4]} />
            <Area type="monotone" dataKey="flux" stroke="#f0a040" strokeWidth={1.6} fill="url(#xrGrad2)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/FlareEventLog.tsx', `
import { useFlareData } from '../../hooks/useFlareData';

export default function FlareEventLog() {
  const { data: flares } = useFlareData();

  function calcDuration(b: string, e: string) {
      if(!b || !e) return 0;
      return Math.round((new Date(e).getTime() - new Date(b).getTime()) / 60000);
  }

  return (
    <div className="card">
      <div className="clbl">FLARE EVENT LOG — NASA DONKI API</div>
      <div>
        {flares?.slice(0, 6).map((f: any) => (
          <div key={f.flrID} className="fl-row">
            <div className={\`fl-badge tc\${f.classType[0]}\`}>{f.classType}</div>
            <div className="fl-desc">
              {f.sourceLocation} · {f.linkedCMEs.length > 0 ? 'CME associated' : 'No CME detected'}
              <span className="fl-time">{new Date(f.peakTime).toLocaleTimeString('en-US', {hour12: false})} IST</span>
              <span className="fl-dur">
                {f.endTime ? \`\${calcDuration(f.beginTime, f.endTime)} min\` : 'Ongoing'}
              </span>
            </div>
            <div style={{width:'32px',height:'3px',background: f.classType[0]==='X' ? '#ff3a3a' : f.classType[0]==='M' ? '#e07520' : '#2e7db5',marginLeft:'auto',alignSelf:'center'}} />
          </div>
        ))}
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/GeoStormStatus.tsx', `
import { useSolarStore } from '../../store/solarStore';

export default function GeoStormStatus() {
  const kp = useSolarStore(s => s.kp);
  
  function kpToGScale(kpVal: number) {
    if (kpVal >= 9) return { scale: 'G5', level: 5 };
    if (kpVal >= 8) return { scale: 'G4', level: 4 };
    if (kpVal >= 7) return { scale: 'G3', level: 3 };
    if (kpVal >= 6) return { scale: 'G2', level: 2 };
    if (kpVal >= 5) return { scale: 'G1', level: 1 };
    return { scale: 'G0', level: 0 };
  }
  
  const { scale, level } = kpToGScale(kp);

  return (
    <div className="card danger">
      <div className="clbl red">GEOMAGNETIC STORM STATUS</div>
      <div className="g-level">
        <div className="g-num">{scale}</div>
        <div className="g-lbl">MODERATE STORM · NOAA SCALE</div>
      </div>
      <div className="g-grid">
        <div className="gg-item"><div className="gg-l">STORM LEVEL</div><div className="gg-v" style={{color:'var(--red)'}}>{scale}</div></div>
        <div className="gg-item"><div className="gg-l">DURATION</div><div className="gg-v" style={{color:'var(--a4)'}}>4.2H</div></div>
        <div className="gg-item"><div className="gg-l">ONSET TIME</div><div className="gg-v" style={{color:'var(--a3)'}}>08:14 IST</div></div>
        <div className="gg-item"><div className="gg-l">PEAK KP</div><div className="gg-v" style={{color:'var(--red)'}}>{kp.toFixed(1)}</div></div>
      </div>
      <div className="g-scale">
        <div className={\`gsc \${level === 1 ? 'gsc-active' : ''}\`} style={{background:'var(--green)'}}><div className="gsc-lbl">G1</div></div>
        <div className={\`gsc \${level === 2 ? 'gsc-active' : ''}\`} style={{background:'var(--a3)'}}><div className="gsc-lbl">G2</div></div>
        <div className={\`gsc \${level === 3 ? 'gsc-active' : ''}\`} style={{background:'#e05010'}}><div className="gsc-lbl">G3</div></div>
        <div className={\`gsc \${level === 4 ? 'gsc-active' : ''}\`} style={{background:'#d03010'}}><div className="gsc-lbl">G4</div></div>
        <div className={\`gsc \${level === 5 ? 'gsc-active' : ''}\`} style={{background:'var(--red)'}}><div className="gsc-lbl">G5</div></div>
      </div>
      
      <div style={{marginTop:'10px'}}>
        <div className="rlbl" style={{marginBottom:'6px'}}>PROTON EVENT STATUS</div>
        <div className="proton-status">
          <div className="proton-dot pd-clear"></div>
          <div className="proton-lbl">10 MeV Proton Event</div>
          <div className="proton-val">BELOW THRESHOLD</div>
        </div>
      </div>
    </div>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/CmePropagation.tsx', `
import { useEffect, useRef, useState } from 'react';
import { useCmeData } from '../../hooks/useCmeData';

export default function CmePropagation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: cme } = useCmeData();
  const [countdown, setCountdown] = useState('--:--:--');

  useEffect(() => {
    if (!cme?.arrivalTime) return;
    const tick = () => {
      const ms = new Date(cme.arrivalTime).getTime() - Date.now();
      if (ms <= 0) { setCountdown('00:00:00'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(\`\${String(h).padStart(2,'0')}:\${String(m).padStart(2,'0')}:\${String(s).padStart(2,'0')}\`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cme?.arrivalTime]);

  useEffect(() => {
    const cme2d = canvasRef.current;
    if (!cme2d) return;
    const ctx2d = cme2d.getContext('2d');
    if (!ctx2d) return;
    
    cme2d.width = cme2d.offsetWidth || 240;
    cme2d.height = 110;
    let cmeR = 22;
    let reqId: number;

    const draw = () => {
      const W = cme2d.width, H = 110;
      ctx2d.clearRect(0, 0, W, H);
      ctx2d.fillStyle = 'rgba(1,0,6,0.98)';
      ctx2d.fillRect(0, 0, W, H);
      
      const sx = 32, sy = H / 2;
      const ex = W - 22, ey = sy;
      
      const sg = ctx2d.createRadialGradient(sx, sy, 4, sx, sy, 26);
      sg.addColorStop(0, '#fffce0');
      sg.addColorStop(0.35, '#f09020');
      sg.addColorStop(1, 'rgba(140,40,0,0)');
      ctx2d.beginPath(); ctx2d.arc(sx, sy, 20, 0, Math.PI * 2);
      ctx2d.fillStyle = sg; ctx2d.fill();

      cmeR = (cmeR + 0.18) % (W - sx - 30);
      for (let w = 0; w < 4; w++) {
        const r = ((cmeR + w * 28) % (W - sx - 28)) + 22;
        const alpha = Math.max(0, 1 - (r / (W - sx - 10)));
        ctx2d.beginPath();
        ctx2d.arc(sx, sy, r, -0.55, 0.55);
        ctx2d.strokeStyle = \`rgba(224,117,32,\${alpha * 0.45})\`;
        ctx2d.lineWidth = 3.5;
        ctx2d.stroke();
      }

      ctx2d.setLineDash([3, 5]);
      ctx2d.beginPath(); ctx2d.moveTo(sx + 22, sy); ctx2d.lineTo(W - 28, sy);
      ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'; ctx2d.lineWidth = 1; ctx2d.stroke();
      ctx2d.setLineDash([]);

      ctx2d.beginPath(); ctx2d.arc(ex, ey, 10, 0, Math.PI * 2);
      ctx2d.fillStyle = '#050e1a'; ctx2d.fill();
      ctx2d.strokeStyle = 'rgba(46,125,181,0.65)'; ctx2d.lineWidth = 2; ctx2d.stroke();
      
      ctx2d.fillStyle = 'rgba(107,101,96,0.7)';
      ctx2d.fillText('SUN', sx - 10, H - 4);
      ctx2d.fillText('EARTH', ex - 14, H - 4);

      reqId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(reqId);
  }, []);

  return (
    <>
      <div className="rlbl">CME PROPAGATION MODEL</div>
      <canvas id="cme2d" ref={canvasRef} style={{ width: '100%', height: '110px', border: '1px solid var(--border-a)', display: 'block', background: 'rgba(1,0,6,0.98)' }}></canvas>

      <div className="cme-box">
        <div className="cme-countdown">{countdown}</div>
        <div className="cme-lbl">ESTIMATED EARTH ARRIVAL · COUNTDOWN</div>
        <div className="cme-track"><div className="cme-prog"></div></div>
      </div>
      <div className="cme-stats">
        <div className="cms"><div className="cms-l">TYPE</div><div className="cms-v">{cme?.type || 'None'}</div></div>
        <div className="cms"><div className="cms-l">SPEED</div><div className="cms-v">{cme?.speed || 0} km/s</div></div>
        <div className="cms"><div className="cms-l">SOURCE</div><div className="cms-v">{cme?.source || 'N/A'}</div></div>
        <div className="cms"><div className="cms-l">DIRECTION</div><div className="cms-v" style={{color: cme?.isEarthDirected ? 'var(--red)' : 'var(--text)'}}>{cme?.isEarthDirected ? 'EARTH' : 'MISS'}</div></div>
        <div className="cms"><div className="cms-l">WINDOW</div><div className="cms-v">{cme?.window || 'N/A'}</div></div>
        <div className="cms"><div className="cms-l">CONFIDENCE</div><div className="cms-v" style={{color:'var(--green)'}}>{cme?.confidence || 'N/A'}</div></div>
      </div>
    </>
  );
}
`);

write('c:/AstraNET/frontend/src/components/solar/AiBrief.tsx', `
import { useSolarStore } from '../../store/solarStore';
import { useSolarBrief } from '../../hooks/useSolarBrief';

export default function AiBrief() {
  const adityaScore = useSolarStore(s => s.adityaScore);
  const { brief, isStreaming } = useSolarBrief(adityaScore);

  return (
    <div className="brief">
      <div className="br-head">
        <div className="br-title">AI MISSION BRIEF · ADITYA</div>
        <div className="br-ts">{new Date().toLocaleTimeString('en-US', {hour12: false})} IST</div>
      </div>
      <div className="br-body">
        {brief || <span className="cur" />}
        {isStreaming && <span className="cur" />}
      </div>
    </div>
  );
}
`);
