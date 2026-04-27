import { useFlareData } from '../../hooks/useFlareData';

export default function FlareEventLog() {
  const { data: flares } = useFlareData();

  function calcDuration(b: string, e: string) {
      if(!b || !e) return 0;
      return Math.round((new Date(e).getTime() - new Date(b).getTime()) / 60000);
  }

  return (
    <div className="card">
      <div className="clbl">FLARE EVENT LOG — NASA DONKI API</div>
      <div>
        {flares?.slice(0, 6).map((f: any) => (
          <div key={f.flrID} className="fl-row">
            <div className={`fl-badge tc${f.classType[0]}`}>{f.classType}</div>
            <div className="fl-desc">
              {f.sourceLocation} · {f.linkedCMEs.length > 0 ? 'CME associated' : 'No CME detected'}
              <span className="fl-time">{new Date(f.peakTime).toLocaleTimeString('en-US', {hour12: false})} IST</span>
              <span className="fl-dur">
                {f.endTime ? `${calcDuration(f.beginTime, f.endTime)} min` : 'Ongoing'}
              </span>
            </div>
            <div style={{width:'32px',height:'3px',background: f.classType[0]==='X' ? '#ff3a3a' : f.classType[0]==='M' ? '#e07520' : '#2e7db5',marginLeft:'auto',alignSelf:'center'}} />
          </div>
        ))}
      </div>
    </div>
  );
}
