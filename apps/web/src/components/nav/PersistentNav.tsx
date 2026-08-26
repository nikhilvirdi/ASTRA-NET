import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * PersistentNav — ASTRANET top navigation
 *
 * Fixed, fully opaque navigation header pinned to the top of the viewport.
 */
export function PersistentNav(): React.ReactElement {
  return (
    <header
      role="banner"
      aria-label="ASTRANET navigation"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-12 bg-sky-950 border-b border-sky-800/40"
    >
      {/* Wordmark Logo */}
      <NavLink
        to="/"
        aria-label="ASTRANET — go to Daily Brief"
        className="flex items-center transition-opacity hover:opacity-80"
        style={{ transitionDuration: 'var(--dur-micro)' }}
      >
        <img src="/logo.svg" alt="ASTRANET" className="h-5 w-auto object-contain" />
      </NavLink>

      {/* Primary nav links */}
      <nav role="navigation" aria-label="Primary navigation">
        <ul className="flex items-center gap-8 list-none m-0 p-0">
          <li>
            <NavItem to="/" label="Home" end />
          </li>
          <li>
            <NavItem to="/explore" label="Explore" />
          </li>
          <li>
            <NavItem to="/best-spot" label="Best Spot" />
          </li>
          <li>
            <NavItem to="/settings" label="Settings" />
          </li>
        </ul>
      </nav>
    </header>
  );
}

/** Individual nav link — styled in Jost font, Title Case, full white text with brass hover/active state. */
function NavItem({
  to,
  label,
  end = false,
}: {
  to: string;
  label: string;
  end?: boolean;
}): React.ReactElement {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'font-jost text-sm font-medium no-underline min-h-[44px] px-2 flex items-center justify-center',
          'transition-colors',
          isActive ? 'text-brass-300 font-semibold' : 'text-white hover:text-brass-300',
        ].join(' ')
      }
      style={{ transitionDuration: 'var(--dur-micro)' }}
    >
      {label}
    </NavLink>
  );
}
