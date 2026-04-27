import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function XRayFluxChart() {
  const xrData = Array.from({ length: 80 }, (_, i) => {
    let base = 0.2 + Math.random() * 0.3;
    if (i === 65) base += 3.0;
    if (i === 64 || i === 66) base += 1.5;
    if (i === 50) base += 1.0;
    return { time: i, flux: Math.max(0, base + Math.sin(i * 0.2) * 0.15) };
  });

  return (
    <div className="card">
      <div className="clbl">X-RAY FLUX — 6H (W/m²) · GOES-16 · FLARE CLASSIFICATION BANDS</div>
      <ResponsiveContainer width="100%" height={70}>
        <AreaChart data={xrData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="xrGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0a040" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f0a040" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 4]} />
            <Area type="monotone" dataKey="flux" stroke="#f0a040" strokeWidth={1.6} fill="url(#xrGrad2)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
