import { useSolarRealtime } from '../../hooks/useSolarRealtime';
export default function SensorReadings() {
  const { data } = useSolarRealtime();
  
  return (
    <div className="lsec">
      <div className="lsec-title">LIVE SENSOR READINGS</div>
      <div className="stat" style={{borderColor:'var(--a-border)'}}>
        <div className="stat-lbl">SOLAR WIND</div>
        <div><span className="stat-val">{data?.speed || '--'}</span><span className="stat-unit">km/s</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">Bz COMPONENT</div>
        <div><span className="stat-val" style={{color:'var(--red)'}}>{data?.bz || '--'}</span><span className="stat-unit">nT</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">PROTON FLUX</div>
        <div><span className="stat-val">{data?.protonFlux || '--'}</span><span className="stat-unit">pfu</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">X-RAY FLUX</div>
        <div><span className="stat-val">{data?.xrayFlux || '--'}</span><span className="stat-unit">W/m²</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">CME SPEED</div>
        <div><span className="stat-val">{data?.speed || '--'}</span><span className="stat-unit">km/s</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">DENSITY</div>
        <div><span className="stat-val">{data?.density || '--'}</span><span className="stat-unit">n/cm³</span></div>
      </div>
      <div className="stat">
        <div className="stat-lbl">TEMPERATURE</div>
        <div><span className="stat-val">{data?.temperature || '--'}</span><span className="stat-unit">K</span></div>
      </div>
    </div>
  );
}
