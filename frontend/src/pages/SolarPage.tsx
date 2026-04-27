import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  AreaChart, Area, 
  XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import './Solar.css';

const SolarPage: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios.get('http://localhost:3000/api/solar/current').then(res => setData(res.data));
    const socket = io('http://localhost:3000');
    socket.on('solar:update', (d) => setData(d));
    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="solar-page-wrapper">
      <div className="root">
        <div className="body">
          {/* LEFT: Sun Hero */}
          <aside className="left">
            <div className="sun-hero">
              <div className="sun-container">
                <div className="sun-glow"></div>
                <div className="sun-sphere"></div>
                <div className="sun-corona"></div>
              </div>
              <div className="sun-status">ASTRA-ADITYA · SOLAR CORE</div>
              <div className="sun-score">{Math.round(data?.flareRisk ?? 12)}%</div>
              <div className="sun-lbl">FLARE PROBABILITY</div>
            </div>
            
            <div className="lsec">
              <div className="lsec-title">SOLAR TELEMETRY</div>
              <div className="stat">
                <div className="stat-lbl">WIND VELOCITY</div>
                <div><span className="stat-val">{data?.solarWindSpeed ?? 420}</span><span className="stat-unit">km/s</span></div>
              </div>
              <div className="stat">
                <div className="stat-lbl">SUNSPOT COUNT</div>
                <div><span className="stat-val">{data?.sunspotCount ?? 0}</span></div>
              </div>
              <div className="stat">
                <div className="stat-lbl">FLUX DENSITY</div>
                <div><span className="stat-val">{Math.round(data?.protonFlux ?? 140)}</span><span className="stat-unit">pfu</span></div>
              </div>
            </div>
          </aside>

          {/* MAIN: Charts and Active Regions */}
          <main className="main">
             <div className="row r3">
                <div className="card">
                   <div className="clbl">X-RAY FLUX (1-8 Å)</div>
                   <div className="big-num" style={{ color: 'var(--solar)' }}>X1.2</div>
                   <div className="big-sub">GOES-16 · PRIMARY SENSOR</div>
                   <div className="ah-body">Solar flare detected in Region AR3088. Ionospheric impact monitoring active.</div>
                </div>
                <div className="card">
                   <div className="clbl">PROTON DENSITY</div>
                   <div className="big-num">{Math.round(data?.protonFlux ?? 12)}</div>
                   <div className="big-sub">DSCOVR · PROTONS/CM³</div>
                </div>
                <div className="card">
                   <div className="clbl">K-INDEX</div>
                   <div className="big-num" style={{ color: 'var(--g3)' }}>Kp 2</div>
                   <div className="big-sub">GEOMAGNETIC DISTURBANCE</div>
                </div>
             </div>

             <div className="card" style={{ flex: 1 }}>
                <div className="clbl">24H SOLAR WIND MAGNITUDE TREND</div>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={Array.from({length: 24}).map((_, i) => ({ x: i, y: 400 + Math.random() * 100 }))}>
                      <defs>
                        <linearGradient id="colorS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--solar)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--solar)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="y" stroke="var(--solar)" fillOpacity={1} fill="url(#colorS)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </main>

          {/* RIGHT: Notifications */}
          <aside className="right">
             <div className="rlbl">SPACE WEATHER ADVISORY</div>
             <div className="brief">
                <div className="br-head">
                  <div className="br-title">SOLAR MISSION BRIEF</div>
                  <div className="br-ts">{new Date().toLocaleTimeString()}</div>
                </div>
                <div className="br-body">
                   Active region AR3088 has produced a minor M-class solar flare. 
                   CME trajectory is currently being modeled. 
                   Potential radio blackout in sun-lit sectors (R1 level).
                   Spacecraft operators advised to monitor SEU rates.
                   <span className="cur"></span>
                </div>
             </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SolarPage;
