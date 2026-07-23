import React, { useEffect, useState } from 'react';

interface FreshnessIndicatorProps {
  /** Timestamp when data was fetched (ISO string or null) */
  fetchedAt: string | null;
  /** Refresh interval in seconds (default 60 for fast tier, 900 for slow tier) */
  ttlSeconds?: number;
  /** Children element (the readout numeral/value) */
  children: React.ReactNode;
}

export function FreshnessIndicator({
  fetchedAt,
  ttlSeconds = 60,
  children,
}: FreshnessIndicatorProps): React.ReactElement {
  const [percentRemaining, setPercentRemaining] = useState<number>(100);

  useEffect(() => {
    if (!fetchedAt) {
      setPercentRemaining(0);
      return;
    }

    const fetchedTime = new Date(fetchedAt).getTime();

    const updatePercentage = () => {
      const elapsedSeconds = (Date.now() - fetchedTime) / 1000;
      const remaining = Math.max(0, 100 - (elapsedSeconds / ttlSeconds) * 100);
      setPercentRemaining(remaining);
    };

    updatePercentage();
    const interval = setInterval(updatePercentage, 1000);
    return () => clearInterval(interval);
  }, [fetchedAt, ttlSeconds]);

  const isDepleted = percentRemaining === 0;

  return (
    <div className="inline-flex flex-col items-start w-fit group">
      {/* Readout value — drops to 60% opacity when depleted */}
      <div
        className={`transition-opacity duration-300 ${isDepleted ? 'opacity-60' : 'opacity-100'}`}
      >
        {children}
      </div>

      {/* 1px depleting freshness rule */}
      <div className="w-full h-[1px] bg-sky-800/40 mt-1 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isDepleted ? 'bg-ember-600' : 'bg-brass-300'}`}
          style={{
            width: `${percentRemaining}%`,
          }}
        />
      </div>
    </div>
  );
}
