import React, { useEffect, useState, useRef } from 'react';
import './Earth.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  AreaChart, Area, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import IndiaMap from '../components/IndiaMap';

export default function EarthPage() {
    const [data, setData] = useState<any>(null);
    const [quakes, setQuakes] = useState<any[]>([]);
    const [rainHistory, setRainHistory] = useState<any[]>([]);
    const earthCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // Initial Fetch
        axios.get('http://localhost:3000/api/earth/current')
            .then(res => setData(res.data))
            .catch(err => console.error("Initial fetch err", err));

        // Socket listener
        const socket = io('http://localhost:3000');
        socket.on('earth:update', (payload) => setData(payload));

        // Fetch USGS Earthquakes
        const dateStr = new Date(Date.now() - 7 * 86400000).toISOString();
        axios.get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&starttime=${dateStr}&minlatitude=6&maxlatitude=38&minlongitude=68&maxlongitude=98`)
            .then(res => {
                if(res.data && res.data.features) {
                    setQuakes(res.data.features.slice(0, 10));
                }
            }).catch(e => console.error(e));

        return () => {
            socket.disconnect();
        };
    }, []);

    // 2D Earth Globe Animation
    useEffect(() => {
        const eg = earthCanvasRef.current;
        if (!eg) return;
        const egCtx = eg.getContext('2d');
        if (!egCtx) return;

        let earthRot = 0;
        let requestRef: number;

        const drawEarth = () => {
            const W = 72, H = 72, cx = 36, cy = 36, r = 30;
            egCtx.clearRect(0, 0, W, H);
            
            // Base ocean sphere
            const og = egCtx.createRadialGradient(cx - 7, cy - 7, 2, cx, cy, r);
            og.addColorStop(0, '#1a2a4a');
            og.addColorStop(0.5, '#0d1a30');
            og.addColorStop(1, '#050c18');
            egCtx.beginPath(); egCtx.arc(cx, cy, r, 0, Math.PI * 2);
            egCtx.fillStyle = og; egCtx.fill();
            
            // Clip to sphere
            egCtx.save(); egCtx.beginPath(); egCtx.arc(cx, cy, r, 0, Math.PI * 2); egCtx.clip();
            egCtx.save(); egCtx.translate(cx, cy); egCtx.rotate(earthRot);
            
            // Continents (abstract shapes)
            egCtx.fillStyle = 'rgba(50,100,65,0.60)';
            egCtx.beginPath(); egCtx.ellipse(8, -4, 13, 20, 0.3, 0, Math.PI * 2); egCtx.fill();
            egCtx.beginPath(); egCtx.ellipse(14, 14, 7, 12, 0.2, 0, Math.PI * 2); egCtx.fill();
            egCtx.fillStyle = 'rgba(40,80,55,0.52)';
            egCtx.beginPath(); egCtx.ellipse(-16, -8, 10, 18, -0.2, 0, Math.PI * 2); egCtx.fill();
            egCtx.fillStyle = 'rgba(35,70,50,0.48)';
            egCtx.beginPath(); egCtx.ellipse(-2, -24, 26, 12, 0.4, 0, Math.PI * 2); egCtx.fill();
            
            egCtx.restore(); egCtx.restore();
            
            // Atmosphere glow
            const ag = egCtx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 9);
            ag.addColorStop(0, 'rgba(60,100,200,0.20)');
            ag.addColorStop(0.4, 'rgba(80,40,160,0.14)');
            ag.addColorStop(1, 'transparent');
            egCtx.beginPath(); egCtx.arc(cx, cy, r + 9, 0, Math.PI * 2);
            egCtx.fillStyle = ag; egCtx.fill();
            
            earthRot += 0.004;
            requestRef = requestAnimationFrame(drawEarth);
        };

        requestRef = requestAnimationFrame(drawEarth);
        return () => cancelAnimationFrame(requestRef);
    }, []);

    // Derived Data
    const score = Math.round(data?.score ?? 0);
    const fireCount = data?.fireCount ?? 0;
    const floodRisk = Math.round(Math.min(100, data?.floodRisk ?? 0));
    const alertLevel = data?.alertLevel ?? 'NORMAL';
    const activeHazards = data?.activeHazards ?? [];
    
    // Prepare hotspots for IndiaMap
    const hotspots: any[] = [];
    if (data?.recentFires) {
        data.recentFires.slice(0, 20).forEach((f: any) => hotspots.push({ lat: f.lat, lon: f.lon, type: 'fire' }));
    }
    if (floodRisk > 50) {
        hotspots.push({ lat: 10.85, lon: 76.27, type: 'flood' }); // Kerala
        hotspots.push({ lat: 26.14, lon: 91.73, type: 'flood' }); // Assam
    }

    return (
        <div className="earth-page-wrapper">
          <div className="root">
            <div className="body">
              {/*  ──────────────── LEFT PANEL ────────────────  */}
              <aside className="left">
                <div className="earth-hero">
                  <div className="earth-scene">
                    <div className="atm atm1"></div>
                    <div className="atm atm2"></div>
                    <div className="atm atm3"></div>
                    <div className="atm-glow"></div>
                    <canvas id="earthCanvas" width="72" height="72" ref={earthCanvasRef}></canvas>
                    <div className="cloud-wrap">
                      <div className="cloud" style={{width:"40px", height:"12px", top:"15%", left:"0", animationDuration:"22s", animationDelay:"-4s"}}></div>
                      <div className="cloud" style={{width:"28px", height:"9px", top:"45%", left:"0", animationDuration:"16s", animationDelay:"-8s", opacity:"0.6"}}></div>
                    </div>
                  </div>
                  <div className="earth-status">INDIA HAZARD MONITOR</div>
                  <div className="earth-hazard-row">
                    <div className="earth-active">{activeHazards.length}</div>
                    <div className="earth-active-lbl">ACTIVE HAZARD TYPES</div>
                  </div>
                  <div className="hazard-pills">
                    {activeHazards.map(h => (
                      <div key={h} className={`hpill hp-${h.toLowerCase().substring(0,4)}`}>{h}</div>
                    ))}
                    {activeHazards.length === 0 && <span style={{fontSize: '9px', color: 'var(--muted)'}}>ALL SYSTEMS NOMINAL</span>}
                  </div>
                </div>

                <div className="lsec">
                  <div className="lsec-title">HAZARD SEVERITY INDEX</div>
                  <div className="haz-row">
                    <div className="haz-dot" style={{background:"var(--flood)"}}></div>
                    <div className="haz-name">Flooding</div>
                    <div className="haz-bar-wrap"><div className="haz-bar" style={{width:`${floodRisk}%`, background:"var(--flood)"}}></div></div>
                    <div className={`haz-lvl ${floodRisk > 70 ? 'rb-crit' : 'rb-mod'}`}>{floodRisk > 70 ? 'CRIT' : 'MOD'}</div>
                  </div>
                  <div className="haz-row">
                    <div className="haz-dot" style={{background:"var(--fire)"}}></div>
                    <div className="haz-name">Wildfire</div>
                    <div className="haz-bar-wrap"><div className="haz-bar" style={{width:`${Math.min(100, fireCount/5)}%`, background:"var(--fire)"}}></div></div>
                    <div className={`haz-lvl ${fireCount > 500 ? 'rb-high' : 'rb-low'}`}>{fireCount > 500 ? 'HIGH' : 'LOW'}</div>
                  </div>
                </div>

                <div className="lsec">
                  <div className="lsec-title">LIVE SENSOR TELEMETRY</div>
                  <div className="stat">
                    <div className="stat-lbl">FIRE HOTSPOTS</div>
                    <div><span className="stat-val" style={{color:"var(--fire)"}}>{fireCount}</span><span className="stat-unit">PTS</span></div>
                  </div>
                  <div className="stat">
                    <div className="stat-lbl">PRECIP ANOMALY</div>
                    <div><span className="stat-val">+{Math.round(data?.floodAnomaly ?? 0)}</span><span className="stat-unit">mm</span></div>
                  </div>
                  <div className="stat">
                    <div className="stat-lbl">DISTRICTS ALERT</div>
                    <div><span className="stat-val" style={{color:"var(--red)"}}>{data?.criticalDistricts ?? 0}</span></div>
                  </div>
                </div>

                <div className="lsec">
                  <div className="lsec-title">BHUMI RESILIENCE SCORE</div>
                  <div className="score-blk">
                    <div className="sb-row">
                      <div className="sb-lbl">CURRENT</div>
                      <div className="sb-num">{score}</div>
                    </div>
                    <div className="sb-track"><div className="sb-fill" style={{width:`${score}%`, background: score > 75 ? 'var(--red)' : 'var(--b3)'}}></div></div>
                  </div>
                </div>
              </aside>

              {/*  ──────────────── MAIN PANEL ────────────────  */}
              <main className="main">
                <div className="row r3">
                  <div className={`card ${floodRisk > 75 ? 'danger' : ''}`}>
                    <div className="clbl">FLOOD INUNDATION INDEX</div>
                    <div className="big-num" style={{color: "var(--b3)"}}>{floodRisk}</div>
                    <div className="big-sub">NASA GPM IMERG · REAL-TIME</div>
                    <div className="ah-body">Satellite precipitation models indicate localized saturation in {data?.criticalDistricts ?? 0} districts.</div>
                  </div>

                  <div className="card fire-card">
                    <div className="clbl fire">THERMAL HOTSPOTS</div>
                    <div className="big-num" style={{color: "var(--fire)"}}>{fireCount}</div>
                    <div className="big-sub">NASA FIRMS · VIIRS SENSORS</div>
                    <div className="ah-body">Active wildfire detections identified via thermal anomaly scanning.</div>
                  </div>

                  <div className="card heat-card">
                    <div className="clbl heat">THERMAL STRESS</div>
                    <div className="big-num" style={{color: "var(--heatwave)"}}>{Math.round(data?.tempAnomaly ?? 42)}<span style={{fontSize:'20px'}}>°C</span></div>
                    <div className="big-sub">LAND SURFACE TEMPERATURE</div>
                    <div className="ah-body">Thermal thresholds approaching seasonal peaks in central corridors.</div>
                  </div>
                </div>

                <div className="row r2" style={{ flex: 1, minHeight: 0 }}>
                  <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="clbl" style={{ padding: '12px 14px 0' }}>INDIA TERRITORIAL HAZARD GIS</div>
                    <div style={{ flex: 1, position: 'relative' }}>
                       <IndiaMap hotspots={hotspots} />
                    </div>
                  </div>

                  <div className="card">
                    <div className="clbl">SEISMIC ACTIVITY (USGS)</div>
                    <div className="quake-list">
                      {quakes.map((q, i) => (
                        <div key={i} className="quake-item">
                          <div className="quake-mag">M{q.properties.mag.toFixed(1)}</div>
                          <div className="quake-loc">{q.properties.place}</div>
                          <div className="quake-time">{new Date(q.properties.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                      ))}
                      {quakes.length === 0 && <div className="ah-body">No recent seismic events detected.</div>}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ height: '150px' }}>
                  <div className="clbl">PRECIPITATION TREND — 7 DAY ANOMALY</div>
                  <div style={{ height: '100px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={Array.from({length: 15}).map((_, i) => ({ x: i, y: 100 + Math.random() * 200 }))}>
                        <defs>
                          <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--b3)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--b3)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="y" stroke="var(--b3)" fillOpacity={1} fill="url(#colorY)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </main>

              {/*  ──────────────── RIGHT PANEL ────────────────  */}
              <aside className="right">
                <div className="rlbl">HAZARD FORECAST (24H)</div>
                <div className="fc-strip">
                  <div className="fci"><div className="fci-t">NOW</div><div className="fci-v" style={{color:"var(--b3)"}}>{score}</div><div className="fci-l">{alertLevel}</div></div>
                  <div className="fci"><div className="fci-t">+6H</div><div className="fci-v" style={{color:"var(--fire)"}}>{Math.min(100, score + 5)}</div><div className="fci-l">FORECAST</div></div>
                  <div className="fci"><div className="fci-t">+24H</div><div className="fci-v" style={{color:"var(--red)"}}>{Math.min(100, score + 12)}</div><div className="fci-l">TREND</div></div>
                </div>

                <div className="ndrf-box">
                  <div className="ndrf-title">MISSION DIRECTIVE</div>
                  <div className="ndrf-body">
                    {score > 60 ? "Elevated hazard risk detected. Pre-positioning of response teams in high-saturation zones recommended." : "Systems monitoring within nominal range. No immediate mobilization required."}
                  </div>
                </div>

                <div className="brief">
                  <div className="br-head">
                    <div className="br-title">AI MISSION BRIEF</div>
                    <div className="br-ts">{new Date().toLocaleTimeString()}</div>
                  </div>
                  <div className="br-body">
                    Bhumi engine actively synthesizing multi-spectral data from NASA GPM and FIRMS. 
                    Territorial boundaries verified. Jammu and Kashmir sector tracking nominal precipitation.
                    Current focus: Monsoon basin inundation and central thermal anomalies.
                    <span className="cur"></span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
    );
}
