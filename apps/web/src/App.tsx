import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PersistentNav } from '@/components/nav/PersistentNav';

// Pages
import { BriefPage } from '@/pages/BriefPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StatusPage } from '@/pages/StatusPage';
import { AboutPage } from '@/pages/AboutPage';

/**
 * ASTRANET App Shell
 *
 * ARCHITECTURE.md §8: "Single persistent app shell wrapping all routes
 * EXCEPT /explore, which is full-bleed and immersive with nav auto-hiding."
 *
 * There is no account system — every route is public. Location and
 * Settings are local to this browser.
 *
 * Route table:
 *   /            public  Daily Brief
 *   /explore     public  Explorable Universe (3D, full-bleed)
 *   /settings    public  Location, local data controls
 *   /status      public  System status
 *   /about       public  About & Causal Engine explanation
 */
export function App(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col bg-sky-950 text-white">
      {/* Skip link for keyboard navigation — §6 Quality Floor */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999]
                   type-micro bg-sky-800 text-sky-100 px-4 py-2 rounded-md"
      >
        SKIP TO CONTENT
      </a>

      <PersistentNav />

      <div className="flex-grow flex flex-col">
        <Routes>
          <Route path="/" element={<BriefPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* 404 fallback */}
          <Route
            path="*"
            element={
              <main id="main-content" className="pt-12 px-8 py-16 flex-grow">
                <p className="type-micro text-brass-500">PAGE NOT FOUND</p>
              </main>
            }
          />
        </Routes>
      </div>
    </div>
  );
}
