import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SpaceBackground from './components/SpaceBackground';
import Dashboard from './pages/Dashboard';
import SolarPage from './pages/SolarPage';
import EarthPage from './pages/EarthPage';
import OrbitalPage from './pages/OrbitalPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <SpaceBackground />
        <div className="vignette"></div>
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/solar" element={<SolarPage />} />
          <Route path="/earth" element={<EarthPage />} />
          <Route path="/orbital" element={<OrbitalPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </div>
    </Router>
  );
}
