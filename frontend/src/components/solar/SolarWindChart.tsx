import { useSolarRealtime } from '../../hooks/useSolarRealtime';
import { useSolarWindChartData } from '../../hooks/useSolarWindChartData';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function SolarWindChart() {
  const { data } = useSolarRealtime();
  const { data: chartData } = useSolarWindChartData();
  const speed = data?.speed ?? 0;
  const needlePos = Math.min(100, Math.max(0, ((speed - 300) / 700) * 100));

  return (
    <>
    <div className="card">
      <div className="clbl">SOLAR WIND SPEED</div>
      <div className="sw-num">{Math.round(speed)}</div>
      <div className="kp-sub">NOAA DSCOVR · km/s</div>
      <div style={{marginTop:'10px'}}>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'var(--muted)',marginBottom:'4px'}}>
          <span>QUIET 300</span><span>ELEVATED 500</span><span>STORM 800</span>
        </div>
        <div className="speed-bar">
          <div className="speed-needle" style={{ left: `${needlePos}%` }}></div>
        </div>
      </div>
    </div>
    
    <div className="card card-s">
      <div className="clbl ca">SOLAR WIND SPEED — 24H CONTINUOUS (km/s) · NOAA DSCOVR L1</div>
      <ResponsiveContainer width="100%" height={72}>
        <AreaChart data={chartData?.history24h ?? []} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="swGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07520" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#e07520" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <ReferenceLine y={800} stroke="rgba(255,58,58,0.22)" strokeDasharray="5 4" />
          <Area dataKey="speed" stroke="#e07520" strokeWidth={1.8} fill="url(#swGrad2)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-m)',fontSize:'7px',color:'rgba(255,255,255,0.35)',marginTop:'4px'}}>
        <span>-24H</span><span>-18H</span><span>-12H</span><span>-6H</span><span>NOW</span>
      </div>
    </div>
    </>
  );
}
