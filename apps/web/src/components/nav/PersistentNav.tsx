import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';

/**
 * PersistentNav — ASTRANET top navigation
 *
 * ARCHITECTURE.md §8:
 * "Single persistent app shell wrapping all routes EXCEPT /explore,
 *  which is full-bleed and immersive with nav auto-hiding."
 *
 * On /explore: auto-hides after 3 seconds of inactivity, returns on
 * pointer-to-top-edge (20px zone). The camera-motion hook (Phase 8,
 * GSAP camera rig) will call store.setNavVisible(false) directly.
 *
 * DESIGN_SPEC.md §11: "Persistent nav auto-hides after 3 seconds of
 * camera motion and returns on pointer-to-top-edge."
 */
export function PersistentNav(): React.ReactElement | null {
  const location = useLocation();
  const isExplore = location.pathname === '/explore';
  const navVisible = useAppStore((s) => s.navVisible);
  const setNavVisible = useAppStore((s) => s.setNavVisible);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On /explore: start 3-second auto-hide timer on mount.
  // Camera motion (Phase 8) will also call setNavVisible(false) directly.
  useEffect(() => {
    if (!isExplore) {
      setNavVisible(true); // Always visible on non-explore routes
      return;
    }

    const scheduleHide = (): void => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setNavVisible(false), 3000);
    };

    scheduleHide();

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isExplore, setNavVisible]);

  // On /explore: show nav when pointer enters top 20px strip
  useEffect(() => {
    if (!isExplore) return;

    const handlePointerMove = (e: PointerEvent): void => {
      if (e.clientY < 20) {
        setNavVisible(true);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [isExplore, setNavVisible]);

  // On non-explore routes, always render (no transition).
  // On /explore, transition in/out via opacity + translateY.
  const shouldRender = !isExplore || navVisible;

  if (!shouldRender && isExplore) return null;

  return (
    <header
      role="banner"
      aria-label="ASTRANET navigation"
      style={{
        transition: `opacity var(--dur-micro) var(--ease-micro),
                     transform var(--dur-micro) var(--ease-micro)`,
        opacity: isExplore && !navVisible ? 0 : 1,
        transform: isExplore && !navVisible ? 'translateY(-100%)' : 'translateY(0)',
        pointerEvents: isExplore && !navVisible ? 'none' : 'auto',
      }}
      className={[
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-between',
        'px-8 h-12', // 48px height — 4-px base scale §6.1
        isExplore ? 'bg-sky-950/80 backdrop-blur-atmosphere' : 'bg-transparent hairline',
      ].join(' ')}
    >
      {/* Wordmark */}
      <NavLink
        to="/"
        aria-label="ASTRANET — go to Daily Brief"
        className="type-micro text-brass-300 hover:text-brass-300/80 transition-colors"
        style={{ transitionDuration: 'var(--dur-micro)' }}
      >
        ASTRANET
      </NavLink>

      {/* Primary nav links */}
      <nav role="navigation" aria-label="Primary navigation">
        <ul className="flex items-center gap-8 list-none m-0 p-0">
          <li>
            <NavItem to="/explore" label="Explore" />
          </li>
          <li>
            <NavItem to="/best-spot" label="Best Spot" />
          </li>
          <li>
            <NavItem to="/log" label="Log" />
          </li>
          <li>
            <NavItem to="/settings" label="Settings" />
          </li>
        </ul>
      </nav>
    </header>
  );
}

/** Individual nav link — active state via brass-300, inactive via sky-400. */
function NavItem({ to, label }: { to: string; label: string }): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'type-micro no-underline',
          'transition-colors',
          isActive ? 'text-brass-300' : 'text-sky-400 hover:text-sky-100',
        ].join(' ')
      }
      style={{ transitionDuration: 'var(--dur-micro)' }}
    >
      {label}
    </NavLink>
  );
}
