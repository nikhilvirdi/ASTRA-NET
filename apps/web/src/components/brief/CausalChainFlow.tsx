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
      delayChildren: 0.1,
    },
  },
};

const nodeVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

const connectorVariants: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: {
    opacity: 1,
    scaleX: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
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
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.34 4.34l2.12 2.12M13.54 13.54l2.12 2.12M4.34 15.66l2.12-2.12M13.54 6.46l2.12-2.12" />
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
      <circle cx="8" cy="10" r="3.5" />
      <path d="M12 4c3 3 3 9 0 12M15 2c4 4 4 12 0 16" />
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
        <path d="M10 3v14M3 10h14" strokeDasharray="3 3" />
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
    ? `CME ARRIVING ${new Date(aurora.cmeArrivalTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()} ±6H`
    : 'CME PROPAGATING (TIME UNKNOWN)';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="flex flex-wrap items-center gap-2 p-3 sm:p-4 bg-sky-950/40 border border-sky-800/50 rounded-sm"
    >
      {/* Node 1: Eruption State */}
      <motion.div
        variants={nodeVariants}
        className="flex items-center gap-2 px-3 py-2 bg-sky-900/90 border border-brass-500/40 rounded-sm"
      >
        <SunFlareIcon className={aurora.hasActiveCme ? 'text-ember-400' : 'text-sky-300'} />
        <span className="font-mono text-xs text-sky-100 font-medium tracking-wide">
          {aurora.hasActiveCme ? 'CME DETECTED' : 'QUIET SUN · NO STORM'}
        </span>
      </motion.div>

      {/* Connector 1 */}
      <motion.div
        variants={connectorVariants}
        className="hidden sm:flex items-center text-brass-500 font-mono text-xs px-1"
      >
        ──→
      </motion.div>

      {/* Node 2: Interplanetary Propagation */}
      <motion.div
        variants={nodeVariants}
        className="flex items-center gap-2 px-3 py-2 bg-sky-900/90 border border-brass-500/40 rounded-sm"
      >
        <InterplanetaryWaveIcon
          className={aurora.hasActiveCme ? 'text-brass-300' : 'text-sky-400'}
        />
        <span className="font-mono text-xs text-sky-200 font-medium tracking-wide">
          {aurora.hasActiveCme ? arrivalText : 'BACKGROUND SOLAR WIND'}
        </span>
      </motion.div>

      {/* Connector 2 */}
      <motion.div
        variants={connectorVariants}
        className="hidden sm:flex items-center text-brass-500 font-mono text-xs px-1"
      >
        ──→
      </motion.div>

      {/* Node 3: Geomagnetic Field (Kp) */}
      <motion.div
        variants={nodeVariants}
        className="flex items-center gap-2 px-3 py-2 bg-sky-900/90 border border-brass-500/40 rounded-sm"
      >
        <MagnetosphereIcon className="text-brass-300" />
        <span className="font-mono text-xs text-brass-300 font-semibold tracking-wide">
          Kp {aurora.kpPredicted} PREDICTED
        </span>
      </motion.div>

      {/* Connector 3 */}
      <motion.div
        variants={connectorVariants}
        className="hidden sm:flex items-center text-brass-500 font-mono text-xs px-1"
      >
        ──→
      </motion.div>

      {/* Node 4: Local Outcome */}
      <motion.div
        variants={nodeVariants}
        className={`flex items-center gap-2 px-3 py-2 border rounded-sm ${
          aurora.visible
            ? 'bg-aurora/15 border-aurora text-aurora font-semibold shadow-[0_0_12px_rgba(78,205,196,0.2)]'
            : 'bg-sky-900/90 border-sky-800 text-sky-400'
        }`}
      >
        <AuroraOutcomeIcon
          active={aurora.visible}
          className={aurora.visible ? 'text-aurora' : 'text-sky-400'}
        />
        <span className="font-mono text-xs tracking-wide">
          {aurora.visible ? 'AURORA POSSIBLE AT YOUR LATITUDE' : 'AURORA UNLIKELY'}
        </span>
      </motion.div>
    </motion.div>
  );
}
