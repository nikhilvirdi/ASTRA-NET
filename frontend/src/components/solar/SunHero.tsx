export default function SunHero() {
  return (
    <div className="sun-hero">
      <div className="sun-scene">
        <div className="cr cr1"></div>
        <div className="cr cr2"></div>
        <div className="cr cr3"></div>
        <div className="cr cr4"></div>
        <div className="cr-glow"></div>
        <div className="spikes" id="spikes">
          {Array.from({length: 14}).map((_, i) => (
             <div key={i} className="spike" style={{
                 height: 10 + Math.random()*16 + 'px',
                 transform: `rotate(${i * (360/14)}deg) translateX(-50%) translateY(-${28 + 10 + Math.random()*16}px)`,
                 animationDelay: `${Math.random() * 2.5}s`,
                 animationDuration: `${1.6 + Math.random() * 1.8}s`
             }} />
          ))}
        </div>
        <div className="sun-core"></div>
      </div>
      <div className="sun-region">ACTIVE REGION AR3664</div>
      <div className="sun-class-row">
        <div className="sun-class">M2.3</div>
        <div className="sun-class-lbl">FLARE CLASS</div>
      </div>
      <div className="flare-alert">
        <div className="fa-dot"></div>
        <div className="fa-text">CME EARTH-DIRECTED · ARRIVAL ~28H</div>
      </div>
    </div>
  );
}
