import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { path: '/', name: 'DASHBOARD' },
    { path: '/solar', name: 'SOLAR' },
    { path: '/earth', name: 'EARTH' },
    { path: '/orbital', name: 'ORBITAL' },
    { path: '/history', name: 'HISTORY' },
  ];

  const getActiveModule = () => {
    switch (location.pathname) {
      case '/solar': return { name: 'ASTRA-ADITYA', sub: 'SOLAR INTELLIGENCE MODULE' };
      case '/earth': return { name: 'ASTRA-BHUMI', sub: 'EARTH HAZARD MODULE' };
      case '/orbital': return { name: 'ASTRA-KAKSHA', sub: 'ORBITAL SURVEILLANCE MODULE' };
      default: return { name: 'ASTRA-NET', sub: 'UNIFIED INTELLIGENCE HUB' };
    }
  };

  const module = getActiveModule();

  return (
    <header className="topbar">
      <div className="logo-block">
        <div className="logo">ASTRA-NET</div>
        <div className="logo-sub">PLANETARY THREAT INTELLIGENCE</div>
      </div>
      
      <div className="sep"></div>
      
      <div className="module-tag">
        <div className="mt-icon">
          <div className="mt-icon-core"></div>
          <div className="mt-icon-r1"></div>
          <div className="mt-icon-r2"></div>
          <div className="mt-icon-r3"></div>
        </div>
        <div className="mt-text">
          <div className="mt-name">{module.name}</div>
          <div className="mt-full">{module.sub}</div>
        </div>
      </div>
      
      <div className="sep"></div>
      
      <nav>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nl ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="topbar-r">
        <div className="live-pill">
          <div className="live-dot"></div>
          LIVE
        </div>
        <div className="clock">
          {time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
        </div>
        {/* Placeholder for Score - will be updated by pages or global store */}
        <div className="score-chip">
          <div>
            <div className="sc-lbl">GLOBAL THREAT</div>
            <div className="sc-val">24</div>
          </div>
          <div className="sc-lvl">NORMAL</div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
