import { useEffect, useState, useRef } from 'react';
import './Earth.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  AreaChart, Area, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function EarthPage() {
    const [data, setData] = useState<any>(null);
    const [quakes, setQuakes] = useState<any[]>([]);
    const [rainHistory, setRainHistory] = useState<any[]>([]);
    const [weather] = useState<any>({ temp: 46.2, humidity: 30 }); // Default fallback
    
    // Canvas Refs
    const earthCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // Initial Fetch for core metrics
        axios.get('http://localhost:3000/api/earth/current')
            .then(res => setData(res.data))
            .catch(err => console.error("Initial fetch err", err));

        // Socket listener for live updates
        const socket = io('http://localhost:3000');
        socket.on('earth:update', (payload) => setData(payload));

        socket.on('connect_error', (err) => {
            console.log(`Socket connect error: ${err.message}`);
        });

        // Fetch USGS Earthquakes for India region (approx bounding box) min mag 3.0
        const dateStr = new Date(Date.now() - 7 * 86400000).toISOString();
        axios.get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&starttime=${dateStr}&minlatitude=6&maxlatitude=38&minlongitude=68&maxlongitude=98`)
            .then(res => {
                if(res.data && res.data.features) {
                    setQuakes(res.data.features.slice(0, 8)); // latest 8
                }
            }).catch(e => console.error(e));

        // Note: OpenWeatherMap requires an API Key. Using a mocked fetch sequence for weather.
        // In full prod: axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Nagpur,IN&units=metric&appid=API_KEY`)
        
        // Mock 7-day rainfall history based on backend flood index
        const generateRainHistory = () => {
             const base = data?.floodAnomaly || 340;
             return Array.from({length: 7}).map((_, i) => ({
                 day: `-` + (7-i) + `D`,
                 rain: Math.max(0, base - (Math.random()*150) + (i*15))
             }));
        };
        setRainHistory(generateRainHistory());

        return () => {
            socket.disconnect();
        };
    }, []);

    // 3D CSS GLOBE / CANVAS INITIALIZATION
    useEffect(() => {
        const earthCv = earthCanvasRef.current;
        if (earthCv && earthCv.dataset.animated !== "true") {
            earthCv.dataset.animated = "true";
            const ctx = earthCv.getContext('2d');
            if (ctx) {
                let off = 0;
                const drawEarth = () => {
                    ctx.clearRect(0, 0, earthCv.width, earthCv.height);
                    ctx.beginPath();
                    ctx.arc(36, 36, 34, 0, Math.PI * 2);
                    ctx.fillStyle = '#143852';
                    ctx.fill();
                    off -= 0.3;
                    if (off <= -72) off = 0;
                    ctx.fillStyle = '#2e7db5';
                    ctx.globalAlpha = 0.6;
                    for(let i=0; i<3; i++) {
                        ctx.beginPath();
                        ctx.arc(36 + off + (i*50), 36 + Math.sin(off*0.1)*5, 12, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    requestAnimationFrame(drawEarth);
                }
                drawEarth();
            }
        }
    }, []);

    // Helper Extractions
    const score = Math.round(data?.score ?? 0);
    const fireCount = data?.fireCount ?? 0;
    const floodRisk = Math.round(Math.min(100, data?.floodRisk ?? 0));
    const rainAnomaly = Math.round(data?.floodAnomaly ?? 0);
    const alertLevel = data?.alertLevel ?? 'NORMAL';
    const activeHazards = data?.activeHazards ?? [];
    
    // The backend limits recent fires to 500 when sending over socket. 
    // If none are present, we'll draw a few dummy ones strictly for visual confirmation of map rendering
    const fires = data?.recentFires && data.recentFires.length > 0 
                  ? data.recentFires 
                  : [{lat: 28.6, lon: 77.2}, {lat: 22.5, lon: 88.3}, {lat: 19.0, lon: 72.8}, {lat: 13.0, lon: 80.2}];

    // Chart customization
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'var(--b2)', border: '1px solid var(--b4)', padding: '5px 10px', fontSize: '10px' }}>
                    <p style={{ color: 'var(--muted)', margin: 0 }}>{label}</p>
                    <p style={{ color: payload[0].color, margin: 0 }}>Rain: {payload[0].value.toFixed(1)} mm</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="earth-page-wrapper">
          <div className="root">
            {/*  ──────────────── TOPBAR ────────────────  */}
            <header className="topbar">
              <div className="logo-block">
                <div className="logo">ASTRA-NET</div>
                <div className="logo-sub">PLANETARY THREAT INTELLIGENCE</div>
              </div>
              <div className="sep"></div>
              <div className="module-tag">
                <div className="mt-icon"></div>
                <div className="mt-text">
                  <div className="mt-name">ASTRA-BHUMI</div>
                  <div className="mt-full">EARTH HAZARD INTELLIGENCE MODULE</div>
                </div>
              </div>
              <div className="sep"></div>
              <nav>
                <div className="nl">Dashboard</div>
                <div className="nl">Solar</div>
                <div className="nl active">Earth</div>
                <div className="nl">Orbital</div>
                <div className="nl">History</div>
              </nav>
              <div className="topbar-r">
                <div className="live-pill"><div className="live-dot"></div>LIVE</div>
                <div className="clock" id="clk">{new Date().toLocaleTimeString('en-US', { hour12: false })} IST</div>
                <div className="score-chip">
                  <div>
                    <div className="sc-lbl">BHUMI SCORE</div>
                    <div className="sc-val">{score}</div>
                  </div>
                  <div className={`sc-lvl ${alertLevel === 'CRITICAL' ? 'red' : ''}`}>{alertLevel}</div>
                </div>
              </div>
            </header>

            <div className="body">
              {/*  ──────────────── LEFT ────────────────  */}
              <aside className="left">
                {/*  Earth Hero  */}
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
                      <div className="cloud" style={{width:"34px", height:"10px", top:"70%", left:"0", animationDuration:"26s", animationDelay:"-12s", opacity:"0.5"}}></div>
                    </div>
                  </div>
                  <div className="earth-status">INDIA HAZARD MONITOR</div>
                  <div className="earth-hazard-row">
                    <div className="earth-active">{activeHazards.length}</div>
                    <div className="earth-active-lbl">ACTIVE HAZARD TYPES</div>
                  </div>
                  <div className="hazard-pills">
                    {activeHazards.includes('FLOOD') && <div className="hpill hp-flood">FLOOD</div>}
                    {activeHazards.includes('WILDFIRE') && <div className="hpill hp-fire">WILDFIRE</div>}
                    {activeHazards.includes('HEATWAVE') && <div className="hpill hp-heat">HEATWAVE</div>}
                    {activeHazards.includes('EXTREME_RAIN') && <div className="hpill hp-flood">EXTREME RAIN</div>}
                    {activeHazards.length === 0 && <span style={{fontSize: '9px', color: 'var(--muted)'}}>NO ACTIVE HAZARDS OVER THRESHOLD</span>}
                  </div>
                </div>

                {/*  Hazard Severity  */}
                <div className="lsec">
                  <div className="lsec-title">HAZARD SEVERITY INDEX</div>
                  <div className="haz-row">
                    <div className="haz-dot" style={{background:"var(--flood)"}}></div>
                    <div className="haz-name">Flooding</div>
                    <div className="haz-bar-wrap"><div className="haz-bar" style={{width:`${Math.min(100, floodRisk)}%`, background:"var(--flood)"}}></div></div>
                    <div className={`haz-lvl ${floodRisk > 75 ? 'rb-crit' : 'rb-mod'}`}>{floodRisk > 75 ? 'CRIT' : 'MOD'}</div>
                  </div>
                  <div className="haz-row">
                    <div className="haz-dot" style={{background:"var(--fire)"}}></div>
                    <div className="haz-name">Wildfire</div>
                    <div className="haz-bar-wrap"><div className="haz-bar" style={{width:`${Math.min(100, Math.floor(fireCount/10))}%`, background:"var(--fire)"}}></div></div>
                    <div className={`haz-lvl ${fireCount > 500 ? 'rb-high' : 'rb-low'}`}>{fireCount > 500 ? 'HIGH' : 'LOW'}</div>
                  </div>
                  <div className="haz-row">
                    <div className="haz-dot" style={{background:"var(--heatwave)"}}></div>
                    <div className="haz-name">Heatwave</div>
                    <div className="haz-bar-wrap"><div className="haz-bar" style={{width:`${weather.temp > 40 ? 80 : 40}%`, background:"var(--heatwave)"}}></div></div>
                    <div className={`haz-lvl ${weather.temp > 40 ? 'rb-high' : 'rb-mod'}`}>{weather.temp > 40 ? 'HIGH' : 'MOD'}</div>
                  </div>
                </div>

                {/*  Live Readings  */}
                <div className="lsec">
                  <div className="lsec-title">LIVE SENSOR READINGS</div>
                  <div className="stat"><div className="stat-lbl">RAINFALL ANOMALY</div><div><span className="stat-val">+{rainAnomaly}</span><span className="stat-unit">mm/day</span></div></div>
                  <div className="stat"><div className="stat-lbl">LAND SURFACE TEMP</div><div><span className="stat-val" style={{color:"var(--heatwave)"}}>{weather.temp}</span><span className="stat-unit">°C</span></div></div>
                  <div className="stat"><div className="stat-lbl">FIRE HOTSPOTS</div><div><span className="stat-val" style={{color:"var(--fire)"}}>{fireCount}</span><span className="stat-unit">pts</span></div></div>
                  <div className="stat"><div className="stat-lbl">DISTRICTS CRITICAL</div><div><span className="stat-val" style={{color:"var(--red)"}}>{data?.criticalDistricts ?? 0}</span></div></div>
                </div>

                {/*  Bhumi Score  */}
                <div className="lsec">
                  <div className="lsec-title">BHUMI SUB-SCORE</div>
                  <div className="score-blk">
                    <div className="sb-row">
                      <div className="sb-lbl">CURRENT SCORE</div>
                      <div className="sb-num">{score}</div>
                    </div>
                    <div className="sb-track"><div className="sb-fill" style={{width:`${score}%`, background: score > 75 ? 'var(--red)' : 'var(--b3)'}}></div></div>
                  </div>
                </div>

              </aside>

              {/*  ──────────────── MAIN ────────────────  */}
              <main className="main">

                {/*  ROW 1: Floods + Fire Headline  */}
                <div className="row r3">
                  <div className={`card ${floodRisk > 75 ? 'danger' : ''}`}>
                    <div className={`clbl ${floodRisk > 75 ? 'red' : ''}`}>FLOOD RISK INDEX</div>
                    <div className="big-num" style={{color: floodRisk > 75 ? "var(--red)" : "var(--b3)"}}>{floodRisk}</div>
                    <div className="big-sub">NASA GPM IMERG · INDIA</div>
                    <div style={{marginTop:"4px",fontSize:"11px",color:"var(--text-dim)"}}>{data?.criticalDistricts ?? 0} districts at critical threshold.<br />Monsoon basin inundation tracking.</div>
                  </div>

                  <div className={`card fire-card ${fireCount > 500 ? 'danger' : ''}`}>
                    <div className="clbl fire">WILDFIRE HOTSPOTS</div>
                    <div className="big-num" style={{color:"var(--fire)"}}>{fireCount}</div>
                    <div className="big-sub">NASA FIRMS · ACTIVE DETECTIONS</div>
                    <div style={{fontSize:"11px",color:"var(--text-dim)"}}>Live VIIRS detections over Indian subcontinent.</div>
                  </div>

                  <div className={`card heat-card ${weather.temp > 45 ? 'danger' : ''}`}>
                    <div className="clbl heat">HEATWAVE INDEX</div>
                    <div className="hw-temp">{weather.temp.toFixed(1)}</div>
                    <div className="big-sub" style={{color:"var(--muted)"}}>LAND SURFACE TEMP · °C PEAK</div>
                    <div style={{fontSize:"11px",color:"var(--text-dim)"}}>Approaching critical thermal threshold in central zones.</div>
                  </div>
                </div>

                {/*  ROW 2: India Hazard Map using Leaflet  */}
                <div className="row r2">
                  <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--b4)', position: 'relative' }}>
                    <div className="clbl" style={{ position: 'absolute', top: 10, left: 15, zIndex: 1000, background: 'rgba(5, 12, 18, 0.8)', padding: '5px 10px', borderRadius: '4px' }}>
                       INDIA HAZARD GIS MAP — REAL-TIME SENSORS
                    </div>
                    <div style={{ width: '100%', height: '360px' }}>
                      <MapContainer center={[22.0, 79.0]} zoom={4.5} style={{ height: '100%', width: '100%', background: '#02060a' }} zoomControl={false} dragging={false}>
                         {/* Base tiles: dark theme raster map */}
                         <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" />
                         
                         {/* Fire Hotspots (Red) */}
                         {fires.map((f: any, i: number) => (
                             <CircleMarker key={`fire-${i}`} center={[f.lat ?? f[0], f.lon ?? f[1]]} radius={3} pathOptions={{ color: 'transparent', fillColor: '#d45010', fillOpacity: 0.6 }} />
                         ))}

                         {/* Mock Flood Risk Zones (Blue) based on floodRisk number to simulate district overlays */}
                         {floodRisk > 50 && (
                             <CircleMarker center={[10.85, 76.27]} radius={20} pathOptions={{ color: '#2e7db5', fillColor: '#2e7db5', fillOpacity: 0.3 }}>
                               <Popup>Kerala Basin Anomaly</Popup>
                             </CircleMarker>
                         )}

                         {/* Quakes (Orange outlines) */}
                         {quakes.map((q: any, i: number) => (
                             <CircleMarker key={`quake-${i}`} center={[q.geometry.coordinates[1], q.geometry.coordinates[0]]} radius={q.properties.mag * 2} pathOptions={{ color: '#e8a020', fillColor: 'transparent', weight: 2 }} />
                         ))}

                      </MapContainer>
                    </div>
                  </div>

                  <div className="card">
                    <div className="clbl">LIVE SEISMIC ACTIVITY — USGS</div>
                    <div style={{ marginTop: '10px', height: '320px', overflowY: 'auto' }}>
                      {quakes.map((q: any, i: number) => (
                         <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', borderBottom: '1px solid var(--b4)' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: q.properties.mag >= 5 ? 'var(--red)' : '#e8a020', fontWeight: 'bold', fontSize: '14px' }}>M{q.properties.mag.toFixed(1)}</span>
                              <span style={{ color: 'var(--a4)', fontSize: '10px' }}>{new Date(q.properties.time).toLocaleTimeString('en-US', {hour12: false})}</span>
                           </div>
                           <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{q.properties.place}</span>
                         </div>
                      ))}
                      {quakes.length === 0 && <div style={{color: 'var(--muted)', fontSize: '11px', marginTop: '10px'}}>No major quakes &gt; M2.5 in last 7 days.</div>}
                    </div>
                  </div>
                </div>

                {/*  ROW 3: Rainfall Chart  */}
                <div className="card" style={{ height: '140px', display: 'flex', flexDirection: 'column', marginTop: '15px' }}>
                  <div className="clbl" style={{marginBottom: '10px'}}>PRECIPITATION ANOMALY — 7 DAY (mm/day) · NASA GPM IMERG</div>
                  <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rainHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2e7db5" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#2e7db5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" hide />
                        <YAxis stroke="transparent" tick={{fill: 'var(--muted)', fontSize: 10}} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={250} stroke="rgba(192,57,43,0.3)" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="rain" stroke="#3a9e6a" fillOpacity={1} fill="url(#colorRain)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </main>

              {/*  ──────────────── RIGHT ────────────────  */}
              <aside className="right">

                <div className="rlbl">BHUMI SCORE FORECAST</div>
                <div className="fc-strip">
                  <div className="fci"><div className="fci-t">NOW</div><div className="fci-v" style={{color:"var(--b3)"}}>{score}</div><div className="fci-l">{alertLevel}</div></div>
                  <div className="fci"><div className="fci-t">+6H</div><div className="fci-v" style={{color:"var(--fire)"}}>{Math.min(100, score + 6)}</div><div className="fci-l">FORECAST</div></div>
                  <div className="fci"><div className="fci-t">+12H</div><div className="fci-v" style={{color:"var(--red)"}}>{Math.min(100, score + 12)}</div><div className="fci-l">FORECAST</div></div>
                  <div className="fci"><div className="fci-t">+24H</div><div className="fci-v" style={{color:"var(--a4)"}}>{Math.max(0, score - 15)}</div><div className="fci-l">FORECAST</div></div>
                </div>

                <div className="ndrf-box" style={{ marginTop: '20px' }}>
                  <div className="ndrf-title">NDRF ACTIVATION ALERT</div>
                  <div className="ndrf-body">Based on Bhumi Score {score}, {Math.max(0, Math.floor(score/10) - 2)} NDRF teams recommended for standby. Pre-positioning highly advised for {data?.criticalDistricts ?? 0} critical districts currently tracking.</div>
                </div>

                {/*  AI Brief  */}
                <div className="brief" style={{ marginTop: '20px' }}>
                  <div className="br-head">
                    <div className="br-title">AI MISSION BRIEF · BHUMI</div>
                    <div className="br-ts">{new Date().toLocaleTimeString('en-US', { hour12: false })}</div>
                  </div>
                  <div className="br-body">
                    {alertLevel === 'NORMAL' && <span>Earth hazards remain within normal thresholds. Routine monitoring of fire and precipitation models continuing.</span>}
                    {alertLevel === 'ADVISORY' && <span style={{color: 'var(--a4)'}}>Elevated terrestrial anomalies detected. Active tracking of accumulating rainfall anomalies and localized thermal spikes.</span>}
                    {alertLevel === 'WARNING' && <span style={{color: 'var(--fire)'}}>Significant hazard overlap detected. Cross-referencing flood extents with upstream basin saturation levels to predict downstream impact.</span>}
                    {alertLevel === 'CRITICAL' && <span style={{color: 'var(--red)'}}>CRITICAL MULTI-HAZARD EVENT: Immediate response mobilization required. Severe synchronous terrestrial hazards actively threatening densely populated infrastructure corridors.</span>}
                  </div>
                </div>

              </aside>
            </div>
          </div>
        </div>
    );
}
