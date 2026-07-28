import React, { useEffect, useState } from 'react';
import { createSkyLogEntry, deleteSkyLogEntry, fetchSkyLog, type SkyLogEntryData } from '@/lib/api';
import {
  calculateLogStats,
  formatEventTypeLabel,
  groupEntriesByMonth,
} from '@/lib/phase10-helpers';

/** LogPage — /log · Personal Sky Log · Phase 10 · DESIGN_SPEC.md §13 */
export function LogPage(): React.ReactElement {
  const [entries, setEntries] = useState<SkyLogEntryData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthed, setIsUnauthed] = useState<boolean>(false);

  // New entry form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newEventType, setNewEventType] = useState<string>('stargazing');
  const [newNotes, setNewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadLog = (): void => {
    setLoading(true);
    setError(null);
    setIsUnauthed(false);

    fetchSkyLog(100)
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.message === 'UNAUTHORIZED') {
          setIsUnauthed(true);
        } else {
          console.error('[LogPage] fetch error:', err);
          setError('Failed to load sky log history.');
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLog();
  }, []);

  const handleAddEntry = (e: React.FormEvent): void => {
    e.preventDefault();
    setSubmitting(true);

    createSkyLogEntry({
      eventType: newEventType,
      timestamp: new Date().toISOString(),
      notes: newNotes.trim() || undefined,
    })
      .then(() => {
        setSubmitting(false);
        setShowAddForm(false);
        setNewNotes('');
        loadLog();
      })
      .catch((err) => {
        console.error('Failed to create log entry:', err);
        setSubmitting(false);
      });
  };

  const handleDeleteEntry = (id: string): void => {
    deleteSkyLogEntry(id)
      .then(() => loadLog())
      .catch((err) => console.error('Failed to delete log entry:', err));
  };

  const stats = calculateLogStats(entries);
  const groupedMonths = groupEntriesByMonth(entries);

  if (isUnauthed) {
    return (
      <main
        id="main-content"
        className="pt-20 pb-16 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center select-none"
      >
        <span className="type-micro text-brass-500 uppercase tracking-widest block mb-2">
          PERSONAL SKY LOG · AUTH REQUIRED
        </span>
        <h1 className="type-display-l text-sky-100 font-serif mb-4">Your Field Journal</h1>
        <p className="type-body text-sky-300 max-w-md mb-8 leading-relaxed">
          Sign in to automatically record sightings, track your observation streak, and maintain a
          private field log.
        </p>
        <a
          href="/login"
          className="px-6 py-3 border border-brass-300 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase tracking-wider transition-colors"
        >
          SIGN IN TO VIEW SKY LOG →
        </a>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="pt-16 pb-20 px-4 sm:px-8 max-w-4xl mx-auto flex flex-col min-h-screen"
      aria-label="Personal Sky Log"
    >
      {/* DESIGN_SPEC.md §13 — Header Stats (data-l, widely spaced, no cards, no boxes) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between border-b border-sky-800/40 pb-8 mb-12 gap-6">
        <div>
          <span className="type-display-l font-mono text-sky-100 block">
            {loading ? '—' : stats.totalSightings}
          </span>
          <span className="type-caption text-sky-400 uppercase tracking-wider block mt-1">
            NIGHTS OBSERVED
          </span>
        </div>

        <div>
          <span className="type-display-l font-mono text-brass-300 block">
            {loading ? '—' : stats.streakDays}
          </span>
          <span className="type-caption text-sky-400 uppercase tracking-wider block mt-1">
            STREAK (DAYS)
          </span>
        </div>

        <div>
          <span className="type-display-l font-mono text-sky-100 block">
            {loading || !stats.lastAurora
              ? 'NONE'
              : new Date(stats.lastAurora)
                  .toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
                  .toUpperCase()}
          </span>
          <span className="type-caption text-sky-400 uppercase tracking-wider block mt-1">
            LAST AURORA
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="sm:self-center px-4 py-2 border border-brass-300/60 text-brass-300 hover:bg-brass-300/10 font-mono text-xs uppercase tracking-wider cursor-pointer transition-colors"
        >
          {showAddForm ? 'CANCEL' : '+ LOG SIGHTING'}
        </button>
      </div>

      {/* Add Sighting Form Modal */}
      {showAddForm && (
        <form
          onSubmit={handleAddEntry}
          className="mb-12 p-6 bg-sky-950/80 border border-brass-300/40 flex flex-col gap-4"
        >
          <span className="type-micro text-brass-300 uppercase tracking-wider font-mono">
            RECORD MANUAL OBSERVATION
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="type-caption text-sky-400 block mb-1">EVENT TYPE</label>
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value)}
                className="w-full bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
              >
                <option value="stargazing">STARGAZING</option>
                <option value="iss_pass">ISS VISIBLE PASS</option>
                <option value="aurora">AURORA BOREALIS</option>
                <option value="meteor_shower">METEOR SHOWER</option>
                <option value="neo_approach">NEAR-EARTH OBJECT</option>
              </select>
            </div>

            <div>
              <label className="type-caption text-sky-400 block mb-1">NOTES (OPTIONAL)</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Clear sky, bright pillars..."
                className="w-full bg-sky-900 border border-sky-700 text-sky-100 p-2 font-mono text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="self-end px-5 py-2 bg-brass-300 text-sky-950 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-brass-300/90 transition-colors"
          >
            {submitting ? 'LOGGING...' : 'SAVE TO LOG'}
          </button>
        </form>
      )}

      {loading && (
        <div className="py-16 text-center font-mono text-xs text-sky-400 animate-pulse">
          LOADING FIELD JOURNAL...
        </div>
      )}

      {error && (
        <div className="p-4 bg-sky-950 border border-ember-400/40 text-xs font-mono text-ember-400 mb-8 text-center">
          {error}
        </div>
      )}

      {/* DESIGN_SPEC.md §13 — Empty State */}
      {!loading && !error && entries.length === 0 && (
        <div className="py-16 px-6 text-center border border-sky-800/40 bg-sky-950/40 flex flex-col items-center gap-4">
          <p className="type-body text-sky-200 text-base max-w-md font-serif italic">
            Nothing logged yet. Your first ISS pass tonight is available — catch it and it lands
            here.
          </p>
          <a
            href="/brief"
            className="type-micro text-brass-300 hover:text-brass-300/80 font-mono uppercase tracking-wider underline"
          >
            VIEW TONIGHT’S BRIEF →
          </a>
        </div>
      )}

      {/* DESIGN_SPEC.md §13 — Timeline: Single vertical brass rule down left */}
      {!loading && entries.length > 0 && (
        <div className="relative pl-6 border-l border-brass-300/40 space-y-12">
          {Array.from(groupedMonths.entries()).map(([monthYear, monthEntries]) => (
            <section key={monthYear} className="relative space-y-8">
              {/* Month Section Header (display-m at low opacity) */}
              <div className="type-display-m font-serif text-sky-500/30 uppercase tracking-widest pointer-events-none -ml-6 pb-2">
                {monthYear}
              </div>

              {/* Entries hanging off rule */}
              <div className="space-y-8">
                {monthEntries.map((entry) => {
                  const entryDate = new Date(entry.timestamp);
                  const dateStr = entryDate
                    .toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })
                    .toUpperCase();
                  const timeStr = entryDate.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <article key={entry.id} className="relative group pl-4">
                      {/* Marker on rule: filled circle for manual, hollow for auto */}
                      <span
                        className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-brass-300 ${
                          entry.source === 'manual' ? 'bg-brass-300' : 'bg-sky-950'
                        }`}
                        title={entry.source === 'manual' ? 'Manually Logged' : 'System Observed'}
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="type-micro font-mono text-brass-300 tracking-wider">
                            {dateStr} · {timeStr}
                          </span>
                          <span className="type-caption font-mono text-sky-100 font-bold uppercase">
                            {formatEventTypeLabel(entry.eventType)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 text-sky-500 hover:text-ember-400 font-mono text-xs transition-opacity cursor-pointer self-end sm:self-auto"
                          aria-label="Delete entry"
                        >
                          DELETE
                        </button>
                      </div>

                      {/* Conditions (mono) */}
                      {entry.details && (
                        <div className="type-micro font-mono text-sky-400 gap-4 flex flex-wrap mb-2">
                          {entry.details.kp !== undefined && <span>Kp {entry.details.kp}</span>}
                          {entry.details.cloudCoverPercent !== undefined && (
                            <span>{entry.details.cloudCoverPercent}% CLOUD</span>
                          )}
                          {entry.details.moonPhase && (
                            <span className="uppercase">{entry.details.moonPhase} MOON</span>
                          )}
                        </div>
                      )}

                      {/* User Notes (serif, italic) */}
                      {entry.notes && (
                        <p className="font-serif italic text-sky-200 text-sm leading-relaxed">
                          "{entry.notes}"
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
