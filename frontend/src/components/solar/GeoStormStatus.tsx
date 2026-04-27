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
        <div className={`gsc ${level === 1 ? 'gsc-active' : ''}`} style={{background:'var(--green)'}}><div className="gsc-lbl">G1</div></div>
        <div className={`gsc ${level === 2 ? 'gsc-active' : ''}`} style={{background:'var(--a3)'}}><div className="gsc-lbl">G2</div></div>
        <div className={`gsc ${level === 3 ? 'gsc-active' : ''}`} style={{background:'#e05010'}}><div className="gsc-lbl">G3</div></div>
        <div className={`gsc ${level === 4 ? 'gsc-active' : ''}`} style={{background:'#d03010'}}><div className="gsc-lbl">G4</div></div>
        <div className={`gsc ${level === 5 ? 'gsc-active' : ''}`} style={{background:'var(--red)'}}><div className="gsc-lbl">G5</div></div>
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
