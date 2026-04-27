import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  BarChart, Bar, 
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import './Orbital.css';

const OrbitalPage: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios.get('http://localhost:3000/api/orbital/current').then(res => setData(res.data));
    const socket = io('http://localhost:3000');
    socket.on('orbital:update', (d) => setData(d));
    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="orbital-page-wrapper">
      <div className="root">
        <div className="body">
          {/* LEFT: Orbital Globe Hero */}
          <aside className="left">
            <div className="globe-hero">
              <div className="globe-scene">
                <div className="osh osh1"></div>
                <div className="osh osh2"></div>
                <div className="osh osh3"></div>
                <div className="osh osh4"></div>
                <div className="mini-earth-placeholder"></div>
              </div>
              <div className="globe-stats">
                <div className="gs-item"><div className="gs-v">27,248</div><div className="gs-l">TRACKED OBJ</div></div>
                <div className="gs-item"><div className="gs-v" style={{ color: 'var(--isro)' }}>8</div><div className="gs-l">ISRO ACTIVE</div></div>
                <div className="gs-item"><div className="gs-v" style={{ color: 'var(--conj)' }}>3</div><div className="gs-l">CONJUNCTIONS</div></div>
              </div>
            </div>

            <div className="lsec">
              <div className="lsec-title">ISRO SATELLITE WATCH</div>
              <div className="isro-item">
                <div className="ii-dot warn"></div>
                <div className="ii-body">
                  <div className="ii-name">CARTOSAT-3</div>
                  <div className="ii-orbit">509 km SSO · 97.4°</div>
                </div>
                <div className="ii-badge iib-warn">CONJ</div>
              </div>
              <div className="isro-item">
                <div className="ii-dot"></div>
                <div className="ii-body">
                  <div className="ii-name">RISAT-2BR1</div>
                  <div className="ii-orbit">576 km SSO · 37°</div>
                </div>
                <div className="ii-badge iib-mon">WATCH</div>
              </div>
              {/* ... more items could go here ... */}
            </div>

            <div className="lsec">
              <div className="lsec-title">ORBITAL ENVIRONMENT</div>
              <div className="stat"><div className="stat-lbl">ACTIVE SATELLITES</div><div><span className="stat-val" style={{ color: 'var(--k4)' }}>9,008</span></div></div>
              <div className="stat"><div className="stat-lbl">TRACKED DEBRIS</div><div><span className="stat-val" style={{ color: 'var(--debris)' }}>18,240</span></div></div>
              <div className="stat"><div className="stat-lbl">CONJUNCTION WARNINGS</div><div><span className="stat-val" style={{ color: 'var(--conj)' }}>3</span></div></div>
            </div>
          </aside>

          {/* MAIN: Charts and Tables */}
          <main className="main">
            <div className="row r3">
              <div className="card conj-card">
                <div className="clbl conj">ACTIVE CONJUNCTIONS</div>
                <div className="big-num" style={{ color: 'var(--conj)' }}>3</div>
                <div className="big-sub">WITHIN 5KM THRESHOLD</div>
                <div className="ah-body">CARTOSAT-3 at critical 0.82 km. TCA in 4h 23m — maneuver window open.</div>
              </div>
              <div className="card">
                <div className="clbl">TOTAL TRACKED OBJECTS</div>
                <div className="big-num" style={{ color: 'var(--k3)' }}>27,248</div>
                <div className="big-sub">US SPACE FORCE CATALOG</div>
              </div>
              <div className="card isro-card">
                <div className="clbl isro">ISRO ASSETS STATUS</div>
                <div className="big-num" style={{ color: 'var(--isro)' }}>8</div>
                <div className="big-sub">ACTIVE MISSION ASSETS</div>
              </div>
            </div>

            <div className="row r2">
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header-bar">
                   <div className="clbl" style={{ margin: 0 }}>NEAR-EARTH ORBITAL ENVIRONMENT — 3D VISUALIZATION</div>
                </div>
                <div className="orbital-globe-placeholder">
                   <div className="gl-info">SGP4 PROPAGATED · CELESTRAK TLE</div>
                </div>
              </div>

              <div className="card">
                <div className="clbl conj">CONJUNCTION WARNING LOG</div>
                <table className="conj-table">
                  <thead>
                    <tr><th>PRIMARY</th><th>SECONDARY</th><th>TCA</th><th>DIST</th><th>PROB</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><div className="ct-sat" style={{ color: 'var(--isro)' }}>CARTOSAT-3</div></td>
                      <td>SL-8 R/B</td>
                      <td>16:42 IST</td>
                      <td style={{ color: 'var(--conj)' }}>0.82km</td>
                      <td><span className="prob-badge pb-crit">1:840</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row r3">
               <div className="card">
                 <div className="clbl">TLE DATA — CARTOSAT-3</div>
                 <div className="tle-block">
                   <div className="tle-label">NORAD 44233</div>
                   <div className="tle-line">1 44233U 19028A   26070.42180556  .00003421</div>
                   <div className="tle-line">2 44233  97.4612 142.8834 0001234  88.4421</div>
                 </div>
               </div>
               <div className="card">
                  <div className="clbl">ORBITAL PARAMETERS</div>
                  <div className="param-row"><div className="p-lbl">INCLINATION</div><div className="p-val">97.46°</div></div>
                  <div className="param-row"><div className="p-lbl">APOGEE ALT</div><div className="p-val">510.2 km</div></div>
               </div>
               <div className="card debris-card">
                  <div className="clbl debris">COLLISION PROBABILITY</div>
                  <div className="big-num" style={{ color: 'var(--conj)', textAlign: 'center' }}>1 : 840</div>
               </div>
            </div>
          </main>

          {/* RIGHT: Feed */}
          <aside className="right">
             <div className="rlbl">ORBITAL ACTIVITY LOG</div>
             <div className="feed-item">
               <div className="fd fdr"></div>
               <div className="feed-body">CONJUNCTION: CARTOSAT-3 at 0.82km TCA. Maneuver suggested.</div>
               <div className="feed-ts">14:22</div>
             </div>
             {/* ... more items ... */}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default OrbitalPage;
