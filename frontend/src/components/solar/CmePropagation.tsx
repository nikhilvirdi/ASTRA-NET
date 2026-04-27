import { useEffect, useRef, useState } from 'react';
import { useCmeData } from '../../hooks/useCmeData';

export default function CmePropagation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: cme } = useCmeData();
  const [countdown, setCountdown] = useState('--:--:--');

  useEffect(() => {
    if (!cme?.arrivalTime) return;
    const tick = () => {
      const ms = new Date(cme.arrivalTime).getTime() - Date.now();
      if (ms <= 0) { setCountdown('00:00:00'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cme?.arrivalTime]);

  useEffect(() => {
    const cme2d = canvasRef.current;
    if (!cme2d) return;
    const ctx2d = cme2d.getContext('2d');
    if (!ctx2d) return;
    
    cme2d.width = cme2d.offsetWidth || 240;
    cme2d.height = 110;
    let cmeR = 22;
    let reqId: number;

    const draw = () => {
      const W = cme2d.width, H = 110;
      ctx2d.clearRect(0, 0, W, H);
      ctx2d.fillStyle = 'rgba(1,0,6,0.98)';
      ctx2d.fillRect(0, 0, W, H);
      
      const sx = 32, sy = H / 2;
      const ex = W - 22, ey = sy;
      
      const sg = ctx2d.createRadialGradient(sx, sy, 4, sx, sy, 26);
      sg.addColorStop(0, '#fffce0');
      sg.addColorStop(0.35, '#f09020');
      sg.addColorStop(1, 'rgba(140,40,0,0)');
      ctx2d.beginPath(); ctx2d.arc(sx, sy, 20, 0, Math.PI * 2);
      ctx2d.fillStyle = sg; ctx2d.fill();

      cmeR = (cmeR + 0.18) % (W - sx - 30);
      for (let w = 0; w < 4; w++) {
        const r = ((cmeR + w * 28) % (W - sx - 28)) + 22;
        const alpha = Math.max(0, 1 - (r / (W - sx - 10)));
        ctx2d.beginPath();
        ctx2d.arc(sx, sy, r, -0.55, 0.55);
        ctx2d.strokeStyle = `rgba(224,117,32,${alpha * 0.45})`;
        ctx2d.lineWidth = 3.5;
        ctx2d.stroke();
      }

      ctx2d.setLineDash([3, 5]);
      ctx2d.beginPath(); ctx2d.moveTo(sx + 22, sy); ctx2d.lineTo(W - 28, sy);
      ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'; ctx2d.lineWidth = 1; ctx2d.stroke();
      ctx2d.setLineDash([]);

      ctx2d.beginPath(); ctx2d.arc(ex, ey, 10, 0, Math.PI * 2);
      ctx2d.fillStyle = '#050e1a'; ctx2d.fill();
      ctx2d.strokeStyle = 'rgba(46,125,181,0.65)'; ctx2d.lineWidth = 2; ctx2d.stroke();
      
      ctx2d.fillStyle = 'rgba(107,101,96,0.7)';
      ctx2d.fillText('SUN', sx - 10, H - 4);
      ctx2d.fillText('EARTH', ex - 14, H - 4);

      reqId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(reqId);
  }, []);

  return (
    <>
      <div className="rlbl">CME PROPAGATION MODEL</div>
      <canvas id="cme2d" ref={canvasRef} style={{ width: '100%', height: '110px', border: '1px solid var(--border-a)', display: 'block', background: 'rgba(1,0,6,0.98)' }}></canvas>

      <div className="cme-box">
        <div className="cme-countdown">{countdown}</div>
        <div className="cme-lbl">ESTIMATED EARTH ARRIVAL · COUNTDOWN</div>
        <div className="cme-track"><div className="cme-prog"></div></div>
      </div>
      <div className="cme-stats">
        <div className="cms"><div className="cms-l">TYPE</div><div className="cms-v">{cme?.type || 'None'}</div></div>
        <div className="cms"><div className="cms-l">SPEED</div><div className="cms-v">{cme?.speed || 0} km/s</div></div>
        <div className="cms"><div className="cms-l">SOURCE</div><div className="cms-v">{cme?.source || 'N/A'}</div></div>
        <div className="cms"><div className="cms-l">DIRECTION</div><div className="cms-v" style={{color: cme?.isEarthDirected ? 'var(--red)' : 'var(--text)'}}>{cme?.isEarthDirected ? 'EARTH' : 'MISS'}</div></div>
        <div className="cms"><div className="cms-l">WINDOW</div><div className="cms-v">{cme?.window || 'N/A'}</div></div>
        <div className="cms"><div className="cms-l">CONFIDENCE</div><div className="cms-v" style={{color:'var(--green)'}}>{cme?.confidence || 'N/A'}</div></div>
      </div>
    </>
  );
}
