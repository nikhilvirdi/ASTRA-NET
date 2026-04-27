import { useSolarStore } from '../../store/solarStore';
import { useSolarBrief } from '../../hooks/useSolarBrief';

export default function AiBrief() {
  const adityaScore = useSolarStore(s => s.adityaScore);
  const { brief, isStreaming } = useSolarBrief(adityaScore);

  return (
    <div className="brief">
      <div className="br-head">
        <div className="br-title">AI MISSION BRIEF · ADITYA</div>
        <div className="br-ts">{new Date().toLocaleTimeString('en-US', {hour12: false})} IST</div>
      </div>
      <div className="br-body">
        {brief || <span className="cur" />}
        {isStreaming && <span className="cur" />}
      </div>
    </div>
  );
}
