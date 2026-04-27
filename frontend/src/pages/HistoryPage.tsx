import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, 
  XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import './History.css';

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    axios.get('http://localhost:3000/api/history').then(res => setHistory(res.data));
  }, []);

  return (
    <div className="history-page-wrapper">
      <div className="root">
        <div className="body">
          {/* LEFT: Archive Hero */}
          <aside className="left">
            <div className="arch-hero">
              <div className="arch-scene">
                <div className="ar ar1"></div>
                <div className="ar ar2"></div>
                <div className="ar ar3"></div>
                <div className="ar ar4"></div>
                <div className="ar-glow"></div>
              </div>
              <div className="arch-region">INCIDENT ARCHIVE · 30 DAYS</div>
              <div className="arch-count-row">
                <div className="arch-count">847</div>
                <div className="arch-count-lbl">TOTAL EVENTS</div>
              </div>
            </div>

            <div className="filter-bar">
               <div className="fb on">ALL</div>
               <div className="fb">COMPOUND</div>
               <div className="fb">SOLAR</div>
               <div className="fb">EARTH</div>
               <div className="fb">ORBITAL</div>
            </div>

            <div className="lsec">
              <div className="lsec-title">30-DAY STATISTICS</div>
              <div className="stat"><div className="stat-lbl">TOTAL EVENTS</div><div><span className="stat-val">847</span></div></div>
              <div className="stat"><div className="stat-lbl">CRITICAL</div><div><span className="stat-val" style={{ color: 'var(--red)' }}>12</span></div></div>
              <div className="stat"><div className="stat-lbl">PEAK UTS</div><div><span className="stat-val" style={{ color: 'var(--red)' }}>89</span></div></div>
            </div>
          </aside>

          {/* MAIN: Incident Log & Trends */}
          <main className="main">
            <div className="row r3">
              <div className="card">
                <div className="clbl">30-DAY UTS PEAK</div>
                <div className="big-num" style={{ color: 'var(--red)' }}>89</div>
                <div className="big-sub">PEAK SCORE · 15 NOV</div>
              </div>
              <div className="card danger">
                <div className="clbl red">CRITICAL INCIDENTS</div>
                <div className="big-num" style={{ color: 'var(--red)' }}>12</div>
              </div>
              <div className="card compound">
                <div className="clbl" style={{ color: 'var(--conj)' }}>COMPOUND DETECTIONS</div>
                <div className="big-num" style={{ color: 'var(--conj)' }}>3</div>
              </div>
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="clbl">UNIFIED THREAT SCORE — 30-DAY HISTORY</div>
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.from({length: 30}).map((_, i) => ({ x: i, y: 30 + Math.random() * 40 }))}>
                    <defs>
                      <linearGradient id="colorH" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--h3)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--h3)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="y" stroke="var(--h3)" fillOpacity={1} fill="url(#colorH)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="row r2">
              <div className="card">
                <div className="clbl">INCIDENT LOG</div>
                <div className="inc-row selected">
                  <div className="inc-badge" style={{ color: 'var(--conj)', border: '1px solid rgba(255,32,96,0.3)' }}>CMPD</div>
                  <div className="inc-body">
                    <div className="inc-title">Compound: CME + Kerala Flood</div>
                    <div className="inc-desc">GPS degraded during NDRF operations.</div>
                    <div className="inc-meta"><span className="inc-ts">15 Nov · 14:22 IST</span></div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="clbl">PATTERN ANALYSIS</div>
                <div className="pat-row">
                  <div className="pat-conf">94%</div>
                  <div className="pat-body">
                    <div className="pat-name">GPS Degradation Correlation</div>
                    <div className="pat-desc">Solar wind + active flood → GPS fail rate 3.2×</div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* RIGHT: Selected Detail */}
          <aside className="right">
            <div className="rlbl">SELECTED INCIDENT DETAIL</div>
            <div className="detail-box">
               <div className="db-title">COMPOUND THREAT — 15 NOV</div>
               <div className="db-body">
                  CME arrival coincided with active Kerala flood response. GPS degradation impacted NDRF coordination.
               </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
