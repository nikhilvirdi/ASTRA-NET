import React from 'react';

interface LivePulseProps {
  /** Label to show next to pulse, default 'LIVE' */
  label?: string;
  /** Active state */
  active?: boolean;
}

export function LivePulse({ label = 'LIVE', active = true }: LivePulseProps): React.ReactElement {
  return (
    <span
      className="inline-flex items-center gap-1.5 type-micro text-brass-500 text-[11px]"
      aria-label={`${label} indicator`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? 'bg-ember-600 animate-pulse' : 'bg-sky-600'
        }`}
      />
      {label}
    </span>
  );
}
