import React from 'react';
import { motion, type Variants } from 'framer-motion';
import type { AuroraCardData } from '@/lib/api';

interface CausalChainFlowProps {
  aurora: AuroraCardData | null;
  loading?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const stageVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

// Engraved SVG Glyphs (§8.1)
function SunFlareIcon({ className = 'w-4 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2.5M10 15.5v2.5M2 10h2.5M15.5 10h2.5M4.34 4.34l1.77 1.77M13.89 13.89l1.77 1.77M4.34 15.66l1.77-1.77M13.89 6.11l1.77-1.77" />
    </svg>
  );
}

function InterplanetaryWaveIcon({
  className = 'w-4 h-4',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 10h14M13 6l4 4-4 4" />
      <path d="M6 5c1.5 2 1.5 8 0 10M10 3c2 3 2 11 0 14" strokeDasharray="2 2" />
    </svg>
  );
}

function MagnetosphereIcon({ className = 'w-4 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="10" r="3" />
      <path d="M11.5 5c2.5 2.5 2.5 7.5 0 10M14.5 3c3.5 3.5 3.5 10.5 0 14" />
    </svg>
  );
}

function AuroraOutcomeIcon({
  active,
  className = 'w-4 h-4',
}: {
  active: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {active ? (
        <path d="M2 14c3-4 6-2 9-5s5 1 7-3M2 17c3-3 6-1 9-4s5 2 7-2" />
      ) : (
        <path d="M10 4v12M4 10h12" strokeDasharray="2.5 2.5" />
      )}
    </svg>
  );
}

export function CausalChainFlow({ aurora, loading }: CausalChainFlowProps): React.ReactElement {
  if (loading) {
    return (
      <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-sm">
        <span className="font-jost text-sm text-sky-400 animate-pulse">
          Evaluating solar causal chain & geomagnetic forecasts...
        </span>
      </div>
    );
  }

  if (!aurora) {
    return (
      <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-sm">
        <span className="font-jost text-sm text-sky-400">
          Causal chain data currently unavailable from NOAA SWPC.
        </span>
      </div>
    );
  }

  const arrivalText = aurora.cmeArrivalTime
    ? `ARRIVING ${new Date(aurora.cmeArrivalTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()} ±6H`
    : 'CME PROPAGATING';

  const stages = [
    {
      id: 'eruption',
      label: 'STAGE 1 · ERUPTION',
      title: aurora.hasActiveCme ? 'CME DETECTED' : 'QUIET SUN',
      detail: aurora.hasActiveCme ? 'Active Solar Flare / CME' : 'No active storm detected',
      icon: <SunFlareIcon className={aurora.hasActiveCme ? 'text-ember-400' : 'text-sky-300'} />,
      highlight: aurora.hasActiveCme,
      highlightColor: 'border-ember-500/40 bg-ember-950/20 text-ember-300',
    },
    {
      id: 'propagation',
      label: 'STAGE 2 · PROPAGATION',
      title: aurora.hasActiveCme ? arrivalText : 'BASE SOLAR WIND',
      detail: aurora.hasActiveCme ? 'Interplanetary Shock Front' : 'Ambient particle stream',
      icon: (
        <InterplanetaryWaveIcon
          className={aurora.hasActiveCme ? 'text-brass-300' : 'text-sky-400'}
        />
      ),
      highlight: aurora.hasActiveCme,
      highlightColor: 'border-brass-500/40 bg-brass-950/20 text-brass-300',
    },
    {
      id: 'geomagnetic',
      label: 'STAGE 3 · GEOMAGNETIC',
      title: `Kp ${aurora.kpPredicted} PREDICTED`,
      detail: aurora.kpPredicted >= 5 ? 'Storm-Level Disturbance' : 'Minor / Quiet Fluctuation',
      icon: <MagnetosphereIcon className="text-brass-300" />,
      highlight: aurora.kpPredicted >= 5,
      highlightColor: 'border-brass-400/50 bg-brass-950/30 text-brass-200',
    },
    {
      id: 'outcome',
      label: 'STAGE 4 · LOCAL OUTCOME',
      title: aurora.visible ? 'AURORA POSSIBLE' : 'AURORA UNLIKELY',
      detail: aurora.visible ? 'At your geomagnetic latitude' : 'Below visibility threshold',
      icon: (
        <AuroraOutcomeIcon
          active={aurora.visible}
          className={aurora.visible ? 'text-aurora' : 'text-sky-400'}
        />
      ),
      highlight: aurora.visible,
      highlightColor: aurora.visible
        ? 'border-aurora bg-aurora/10 text-aurora shadow-[0_0_12px_rgba(78,205,196,0.15)]'
        : 'border-sky-800 bg-sky-950/40 text-sky-400',
    },
  ];

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-baseline">
        <span className="type-caption text-sky-400 block">CAUSAL PROPAGATION PIPELINE</span>
        <span className="font-jost text-xs text-brass-400 font-medium">SOLAR TO LOCAL</span>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 sm:p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm relative"
      >
        {stages.map((stage) => (
          <React.Fragment key={stage.id}>
            <motion.div
              variants={stageVariants}
              className={`flex flex-col justify-between p-3 rounded-sm border transition-all ${
                stage.highlight
                  ? stage.highlightColor
                  : 'border-sky-800/60 bg-sky-900/40 text-sky-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-jost text-[9.5px] uppercase font-medium tracking-wider text-sky-400">
                  {stage.label}
                </span>
                <div className="flex-shrink-0">{stage.icon}</div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs sm:text-sm font-semibold tracking-tight">
                  {stage.title}
                </span>
                <span className="font-jost text-[10px] text-sky-400/90 font-normal">
                  {stage.detail}
                </span>
              </div>
            </motion.div>
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}
