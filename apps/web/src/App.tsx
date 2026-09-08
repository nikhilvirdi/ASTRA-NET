import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { PersistentNav } from '@/components/nav/PersistentNav';
import { useAppStore } from '@/store';
import { shouldRedirectToExplore } from '@/lib/landing-page';

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
 *
 * `defaultLandingPage` (Settings) redirects "/" to "/explore" exactly once,
 * on this component's mount — i.e. the first load of a session, not every
 * visit to "/". The effect's empty dependency array is deliberate: it must
 * NOT re-run on later navigation, or clicking Home (which routes to "/")
 * would bounce back to Explore forever, making the Brief page unreachable.
 * See lib/landing-page.ts's `shouldRedirectToExplore` for the decision logic.
 */
export function App(): React.ReactElement {
  const defaultLandingPage = useAppStore((s) => s.defaultLandingPage);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldRedirectToExplore(location.pathname, defaultLandingPage)) {
      navigate('/explore', { replace: true });
    }
    // Mount-only: see the doc comment above for why this must not depend on
    // `location`/`defaultLandingPage` re-running it on later navigation.
  }, []);

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
