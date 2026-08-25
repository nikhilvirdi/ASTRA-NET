import React from 'react';

interface MoonPhaseGraphicProps {
  illuminatedFraction: number;
  phaseAngleDeg: number;
  phaseName: string;
  size?: number;
}

export function MoonPhaseGraphic({
  illuminatedFraction,
  phaseAngleDeg,
  phaseName,
  size = 48,
}: MoonPhaseGraphicProps): React.ReactElement {
  const r = 18;
  const cx = 24;
  const cy = 24;
  const f = Math.max(0, Math.min(1, illuminatedFraction));

  // Determine if moon is waxing (light on right) or waning (light on left)
  const isWaxing =
    phaseAngleDeg < 180 ||
    phaseName.toLowerCase().includes('waxing') ||
    phaseName === 'firstQuarter';

  // Terminator semi-minor axis
  const rx = Math.max(0.1, r * Math.abs(2 * f - 1));

  let litPath = '';
  if (f > 0.02 && f < 0.98) {
    if (isWaxing) {
      if (f < 0.5) {
        // Crescent: outer right arc + inner terminator curved right
        litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 0 ${cx} ${cy - r} Z`;
      } else {
        // Gibbous: outer right arc + inner terminator curved left
        litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 1 ${cx} ${cy - r} Z`;
      }
    } else {
      // Waning
      if (f < 0.5) {
        // Crescent: outer left arc + inner terminator curved left
        litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 1 ${cx} ${cy - r} Z`;
      } else {
        // Gibbous: outer left arc + inner terminator curved right
        litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 0 ${cx} ${cy - r} Z`;
      }
    }
  }

  return (
    <div
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" className="w-full h-full">
        {/* Soft atmospheric lunar glow */}
        <defs>
          <filter id="moon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dark moon base disc */}
        <circle cx={cx} cy={cy} r={r} fill="#141414" stroke="#2a3434" strokeWidth="1" />

        {/* Craters / maria on dark side */}
        <circle cx={cx - 5} cy={cy - 4} r="3.5" fill="#0a0a0a" opacity="0.6" />
        <circle cx={cx + 6} cy={cy + 5} r="4.5" fill="#0a0a0a" opacity="0.5" />
        <circle cx={cx - 4} cy={cy + 7} r="2.5" fill="#0a0a0a" opacity="0.5" />
        <circle cx={cx + 3} cy={cy - 8} r="2" fill="#0a0a0a" opacity="0.4" />

        {/* Lit region */}
        {f >= 0.98 ? (
          <circle cx={cx} cy={cy} r={r} fill="#EEF1F1" filter="url(#moon-glow)" />
        ) : litPath ? (
          <path d={litPath} fill="#EEF1F1" filter="url(#moon-glow)" />
        ) : null}

        {/* Subtle maria overlay on lit region */}
        {f > 0.05 && (
          <g opacity="0.12" fill="#2a3434">
            <circle cx={cx - 4} cy={cy - 3} r="3.5" />
            <circle cx={cx + 5} cy={cy + 4} r="4" />
            <circle cx={cx - 3} cy={cy + 6} r="2.5" />
          </g>
        )}
      </svg>
    </div>
  );
}
