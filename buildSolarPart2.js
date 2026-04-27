const fs = require('fs');
const path = require('path');

const write = (p, content) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content.trim() + '\n');
};

write('c:/AstraNET/frontend/src/pages/SolarPage.tsx', `
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useSolarStore } from '../store/solarStore';
import '../styles/solar.css';

import SunHero from '../components/solar/SunHero';
import SensorReadings from '../components/solar/SensorReadings';
import InfraImpactList from '../components/solar/InfraImpactList';
import KpIndexChart from '../components/solar/KpIndexChart';
import BzChart from '../components/solar/BzChart';
import SolarWindChart from '../components/solar/SolarWindChart';
import XRayFluxChart from '../components/solar/XRayFluxChart';
import FlareEventLog from '../components/solar/FlareEventLog';
import GeoStormStatus from '../components/solar/GeoStormStatus';
import CmePropagation from '../components/solar/CmePropagation';
import AiBrief from '../components/solar/AiBrief';

export default function SolarPage() {
  
  useEffect(() => {
    const socket = io('http://localhost:3000');
    socket.on('solar:update', (data) => {
      useSolarStore.setState({
        kp: data.kp || 0,
        bz: data.bz || 0,
        speed: data.speed || 0,
        density: data.density || 0,
        temperature: data.temperature || 0,
        adityaScore: data.adityaScore || 0,
        gScale: 'G0' // Simplified mapping
      });
    });
    return () => { socket.disconnect(); }
  }, []);

  const adityaScore = useSolarStore(s => s.adityaScore);

  return (
    <div className="page" id="page-solar">
      <header className="topbar">
        <div className="logo-block">
          <div className="logo">ASTRA-NET</div>
          <div className="logo-sub">PLANETARY THREAT INTELLIGENCE</div>
        </div>
        <div className="sep"></div>
        <div className="module-tag">
          <div className="mt-icon"></div>
          <div className="mt-text">
            <div className="mt-name">ASTRA-ADITYA</div>
            <div className="mt-full">SOLAR INTELLIGENCE MODULE</div>
          </div>
        </div>
        <div className="sep"></div>
        <nav>
          <div className="nl">Dashboard</div>
          <div className="nl active">Solar</div>
          <div className="nl">Earth</div>
          <div className="nl">Orbital</div>
          <div className="nl">History</div>
        </nav>
        <div className="topbar-r">
          <div className="live-pill"><div className="live-dot"></div>LIVE</div>
          <div className="clock" id="clk">{new Date().toLocaleTimeString('en-US', { hour12: false })} IST</div>
          <div className="score-chip">
            <div>
              <div className="sc-lbl">ADITYA SCORE</div>
              <div className="sc-val">{adityaScore || '--'}</div>
            </div>
            <div className="sc-lvl">WARNING</div>
          </div>
        </div>
      </header>

      <div className="body">
        <aside className="left">
          <SunHero />
          <SensorReadings />
          
          <div className="lsec">
            <div className="lsec-title">ADITYA SUB-SCORE</div>
            <div className="score-blk">
              <div className="sb-row">
                <div className="sb-lbl">CURRENT SCORE</div>
                <div className="sb-num" style={{color:'var(--a3)'}}>{adityaScore || '--'}</div>
              </div>
              <div className="sb-track"><div className="sb-fill" style={{width: \`\${adityaScore}%\`, background: 'linear-gradient(90deg,#7a2c00,var(--a3),var(--a4))'}}></div></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',marginTop:'8px'}}>
              <div className="cms"><div className="cms-l">KP CONTRIB</div><div className="cms-v">+10</div></div>
              <div className="cms"><div className="cms-l">FLARE BONUS</div><div className="cms-v">+15</div></div>
              <div className="cms"><div className="cms-l">CME INBOUND</div><div className="cms-v">+0</div></div>
              <div className="cms"><div className="cms-l">CME &lt;24H</div><div className="cms-v">+0</div></div>
            </div>
          </div>

          <InfraImpactList />
        </aside>

        <main className="main">
          <div className="row r3">
            <KpIndexChart />
            <BzChart />
            <SolarWindChart />
          </div>
          
          <XRayFluxChart />
          
          <div className="row r2">
             <FlareEventLog />
             <GeoStormStatus />
          </div>
        </main>

        <aside className="right">
          <CmePropagation />
          
          <div className="gps-alert" style={{marginTop:'12px'}}>
            <div className="gps-title">GPS DEGRADATION ALERT</div>
            <div className="gps-body">Upon CME arrival, GPS accuracy over India may degrade 15–40 m. Aviation and disaster relief should activate backup navigation protocols for the impact window.</div>
          </div>

          <div className="rlbl" style={{marginTop:'12px'}}>ADITYA SCORE FORECAST</div>
          <div className="fc-strip">
            <div className="fc-item"><div className="fc-t">NOW</div><div className="fc-v" style={{color:'var(--a3)'}}>{adityaScore || '--'}</div><div className="fc-l">WARNING</div></div>
            <div className="fc-item"><div className="fc-t">+6H</div><div className="fc-v" style={{color:'var(--a3)'}}>74</div><div className="fc-l">WARNING</div></div>
            <div className="fc-item"><div className="fc-t">+12H</div><div className="fc-v" style={{color:'var(--red)'}}>88</div><div className="fc-l">CRITICAL</div></div>
            <div className="fc-item"><div className="fc-t">+24H</div><div className="fc-v" style={{color:'var(--red)'}}>94</div><div className="fc-l">CRITICAL</div></div>
          </div>

          <div className="rlbl" style={{marginTop:'12px'}}>NOAA SPACE WEATHER FEED</div>
          <div>
            <div className="feed-item"><div className="fd fdo"></div><div className="feed-body">Solar wind speed elevated at L1 point.</div><div className="feed-ts">LIVE</div></div>
          </div>

          <AiBrief />
        </aside>
      </div>
    </div>
  );
}
`);
