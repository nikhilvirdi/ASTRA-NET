import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [earthData, setEarthData] = useState<any>(null);
  const [solarData, setSolarData] = useState<any>(null);
  const [orbitalData, setOrbitalData] = useState<any>(null);

  useEffect(() => {
    // Initial Fetch
    const fetchData = async () => {
      try {
        const [earth, solar, orbital] = await Promise.all([
          axios.get('http://localhost:3000/api/earth/current'),
          axios.get('http://localhost:3000/api/solar/current'),
          axios.get('http://localhost:3000/api/orbital/current'),
        ]);
        setEarthData(earth.data);
        setSolarData(solar.data);
        setOrbitalData(orbital.data);
      } catch (err) {
        console.error("Dashboard fetch error", err);
      }
    };
    fetchData();

    // Sockets
    const socket = io('http://localhost:3000');
    socket.on('earth:update', (d) => setEarthData(d));
    socket.on('solar:update', (d) => setSolarData(d));
    socket.on('orbital:update', (d) => setOrbitalData(d));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-grid">
        {/* HERO SECTION */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">PLANETARY DEFENSE COMMAND</h1>
            <p className="hero-subtitle">Unified Monitoring & Strategic Intelligence</p>
          </div>
          <div className="global-threat">
            <div className="threat-label">SYSTEM INTEGRITY</div>
            <div className="threat-value">98.4%</div>
            <div className="threat-bar"><div className="threat-fill" style={{ width: '98.4%' }}></div></div>
          </div>
        </section>

        {/* MODULE CARDS */}
        <div className="modules-row">
          {/* SOLAR CARD */}
          <Link to="/solar" className="module-card solar-card">
            <div className="mc-head">
              <div className="mc-title">ASTRA-ADITYA</div>
              <div className="mc-status">ACTIVE</div>
            </div>
            <div className="mc-body">
              <div className="mc-big-val" style={{ color: 'var(--solar)' }}>{Math.round(solarData?.flareRisk ?? 12)}%</div>
              <div className="mc-lbl">SOLAR FLARE RISK</div>
              <div className="mc-stat">
                <span>SUNSPOT COUNT:</span>
                <span>{solarData?.sunspotCount ?? 0}</span>
              </div>
            </div>
            <div className="mc-footer">SOLAR INTELLIGENCE MODULE &rarr;</div>
          </Link>

          {/* EARTH CARD */}
          <Link to="/earth" className="module-card earth-card">
            <div className="mc-head">
              <div className="mc-title">ASTRA-BHUMI</div>
              <div className="mc-status">ACTIVE</div>
            </div>
            <div className="mc-body">
              <div className="mc-big-val" style={{ color: 'var(--earth)' }}>{Math.round(earthData?.score ?? 24)}</div>
              <div className="mc-lbl">BHUMI THREAT SCORE</div>
              <div className="mc-stat">
                <span>ACTIVE HAZARDS:</span>
                <span>{earthData?.activeHazards?.length ?? 0}</span>
              </div>
            </div>
            <div className="mc-footer">EARTH HAZARD MODULE &rarr;</div>
          </Link>

          {/* ORBITAL CARD */}
          <Link to="/orbital" className="module-card orbital-card">
            <div className="mc-head">
              <div className="mc-title">ASTRA-KAKSHA</div>
              <div className="mc-status">ACTIVE</div>
            </div>
            <div className="mc-body">
              <div className="mc-big-val" style={{ color: 'var(--orbital)' }}>{orbitalData?.debrisCount ?? 1420}</div>
              <div className="mc-lbl">DEBRIS TRACKED</div>
              <div className="mc-stat">
                <span>CONJUNCTIONS:</span>
                <span>{orbitalData?.conjunctions?.length ?? 0}</span>
              </div>
            </div>
            <div className="mc-footer">ORBITAL SURVEILLANCE &rarr;</div>
          </Link>
        </div>

        {/* LIVE FEED & AI BRIEF */}
        <div className="dashboard-bottom">
          <div className="card live-feed">
            <div className="clbl">LIVE SYSTEM TELEMETRY</div>
            <div className="feed-items">
              <div className="feed-item">
                <span className="ts">{new Date().toLocaleTimeString()}</span>
                <span className="msg">Solar wind velocity: {solarData?.solarWindSpeed ?? 420} km/s. Stable.</span>
              </div>
              <div className="feed-item">
                <span className="ts">{new Date().toLocaleTimeString()}</span>
                <span className="msg">Earth hazard scan complete. {earthData?.fireCount ?? 0} hotspots detected.</span>
              </div>
              <div className="feed-item">
                <span className="ts">{new Date().toLocaleTimeString()}</span>
                <span className="msg">Orbital decay calculation for TLE sequence {orbitalData?.activeSatellites ?? 0} finished.</span>
              </div>
            </div>
          </div>

          <div className="brief-box">
             <div className="br-head">AI COMMAND BRIEF</div>
             <div className="br-body">
                System ASTRA-NET is currently operating at nominal capacity. 
                Solar activity is monitoring sunspot cluster AR3088. 
                Earth Bhumi engine reports elevated thermal anomalies in the central Indian corridor. 
                Orbital Kaksha module has updated TLE catalogs for high-threat debris clusters. 
                No immediate planetary defense actions required.
                <span className="cur"></span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
