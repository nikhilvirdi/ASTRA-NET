import { useKpData } from '../../hooks/useKpData';
import { BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function KpIndexChart() {
  const { data: kpData } = useKpData();
  const currentKp = kpData?.current ?? 0;

  return (
    <div className="card">
      <div className="clbl">KP INDEX — PLANETARY</div>
      <div className="kp-num">{currentKp.toFixed(1)}</div>
      <div className="kp-sub">NOAA SWPC · REAL-TIME</div>
      
      <div className="kp-scale">
        {Array.from({length: 9}, (_, i) => (
          <div key={i} className={`ks ${i < Math.floor(currentKp) ? (currentKp >= 6 ? 'warn' : 'on') : ''}`} />
        ))}
      </div>
      <div className="ks-labels">
        <span>0</span><span>3</span><span>6</span><span>9</span>
      </div>
      
      <div style={{marginTop: '15px'}}>
        <div className="clbl">KP INDEX — 48H HISTORY</div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={kpData?.history48h ?? []} barSize={8} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 9]} />
            <ReferenceLine y={5} stroke="rgba(255,58,58,0.18)" strokeDasharray="4 4" />
            <Bar dataKey="kp" isAnimationActive={false}>
              {(kpData?.history48h ?? []).map((entry: any, i: number) => (
                <Cell key={i} fill={entry.kp >= 6 ? '#ff3a3a' : entry.kp >= 4 ? '#e07520' : 'rgba(224,117,32,0.35)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginTop:'4px'}}>
          <span>-48H</span><span>-36H</span><span>-24H</span><span>-12H</span><span>NOW</span>
        </div>
      </div>
    </div>
  );
}
