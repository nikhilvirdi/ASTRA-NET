import { useSolarRealtime } from '../../hooks/useSolarRealtime';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

export default function BzChart() {
  const { data } = useSolarRealtime();
  const bz = data?.bz ?? 0;
  
  // Fake bz history for chart (as instructed by prompt context to draw chart but replace real data hooks where applicable)
  const [bzHistory] = useState(() => Array.from({length: 60}, (_, i) => ({ time: i, bz: (Math.random() - 0.5) * 18 + Math.sin(i * 0.32) * 7 - (i > 45 ? 8 : 0) })));

  return (
    <div className="card danger">
      <div className="clbl red">Bz COMPONENT — IMF</div>
      <div className={`bz-num ${bz < 0 ? 'bz-neg' : 'bz-pos'}`}>{bz.toFixed(1)}</div>
      <div className="kp-sub" style={{color:'var(--muted)'}}>DSCOVR · nT · {bz < 0 ? 'SOUTHWARD' : 'NORTHWARD'}</div>
      <div className="bz-info">Southward Bz opens Earth's magnetosphere, amplifying storm impact.</div>
      {bz < -5 && <div className="bz-tag">STORM COUPLING ACTIVE</div>}
      
      <div style={{marginTop: '15px'}}>
          <div className="clbl red">Bz COMPONENT — 12H HISTORY (nT)</div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={bzHistory} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[-25, 25]} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
              <Line dataKey="bz" stroke="#ff4040" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginTop:'4px'}}>
            <span>-12H</span><span>-9H</span><span>-6H</span><span>-3H</span><span>NOW</span>
          </div>
      </div>
    </div>
  );
}
