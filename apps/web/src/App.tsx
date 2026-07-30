import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PersistentNav } from '@/components/nav/PersistentNav';

// Pages
import { BriefPage } from '@/pages/BriefPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { BestSpotPage } from '@/pages/BestSpotPage';
import { LogPage } from '@/pages/LogPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AccuracyPage } from '@/pages/AccuracyPage';
import { SharePage } from '@/pages/SharePage';

/**
 * ASTRANET App Shell
 *
 * ARCHITECTURE.md §8: "Single persistent app shell wrapping all routes
 * EXCEPT /explore, which is full-bleed and immersive with nav auto-hiding."
 *
 * There is no account system — every route is public. Location, the
 * Personal Sky Log, and Settings are all local to this browser.
 *
 * Route table:
 *   /            public  Daily Brief
 *   /explore     public  Explorable Universe (3D, full-bleed)
 *   /best-spot   public  Best-Spot-Tonight Finder
 *   /log         public  Personal Sky Log (local-only)
 *   /settings    public  Location, alerts, local data controls
 *   /accuracy    public  Track record
 *   /share/:id   public  Shareable Sky Card
 */
export function App(): React.ReactElement {
  return (
    <>
      {/* Skip link for keyboard navigation — §6 Quality Floor */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999]
                   type-micro bg-sky-800 text-sky-100 px-4 py-2 rounded-md"
      >
        SKIP TO CONTENT
      </a>

      <PersistentNav />

      <Routes>
        <Route path="/" element={<BriefPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/best-spot" element={<BestSpotPage />} />
        <Route path="/accuracy" element={<AccuracyPage />} />
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 404 fallback */}
        <Route
          path="*"
          element={
            <main id="main-content" className="pt-12 px-8 py-16">
              <p className="type-micro text-brass-500">PAGE NOT FOUND</p>
            </main>
          }
        />
      </Routes>
    </>
  );
}
