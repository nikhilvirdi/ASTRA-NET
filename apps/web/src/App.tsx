import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PersistentNav } from '@/components/nav/PersistentNav';
import { useAppStore } from '@/store';

// Pages
import { BriefPage } from '@/pages/BriefPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { BestSpotPage } from '@/pages/BestSpotPage';
import { LogPage } from '@/pages/LogPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AccuracyPage } from '@/pages/AccuracyPage';
import { LoginPage } from '@/pages/LoginPage';

/**
 * ASTRANET App Shell
 *
 * ARCHITECTURE.md §8: "Single persistent app shell wrapping all routes
 * EXCEPT /explore, which is full-bleed and immersive with nav auto-hiding."
 *
 * Route table (ARCHITECTURE.md §8):
 *   /            public  Daily Brief
 *   /explore     public  Explorable Universe (3D, full-bleed)
 *   /best-spot   public  Best-Spot-Tonight Finder
 *   /log         auth    Personal Sky Log
 *   /settings    auth    Saved locations, alerts, account
 *   /login       public  Auth (mode=login|signup)
 *   /signup      →       Redirect to /login?mode=signup
 *   /accuracy    public  Track record
 */
export function App(): React.ReactElement {
  const user = useAppStore((s) => s.user);

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
        {/* Public routes */}
        <Route path="/" element={<BriefPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/best-spot" element={<BestSpotPage />} />
        <Route path="/accuracy" element={<AccuracyPage />} />

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        {/* /signup → /login?mode=signup (same component, mode toggle) */}
        <Route path="/signup" element={<Navigate to="/login?mode=signup" replace />} />

        {/* Protected routes — redirect to /login if unauthenticated */}
        <Route path="/log" element={user ? <LogPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/settings"
          element={user ? <SettingsPage /> : <Navigate to="/login" replace />}
        />

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
