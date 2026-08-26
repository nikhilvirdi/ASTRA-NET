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
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 h-12 bg-sky-950 border-b border-sky-800/40"
    >
      {/* Wordmark Logo */}
      <NavLink
        to="/"
        aria-label="ASTRANET — go to Daily Brief"
        className="flex items-center transition-opacity hover:opacity-80 flex-shrink-0"
        style={{ transitionDuration: 'var(--dur-micro)' }}
      >
        <img src="/logo.svg" alt="ASTRANET" className="h-4 sm:h-5 w-auto object-contain" />
      </NavLink>

      {/* Primary nav links */}
      <nav role="navigation" aria-label="Primary navigation">
        <ul className="flex items-center gap-1.5 sm:gap-6 md:gap-8 list-none m-0 p-0">
          <li>
            <NavItem to="/" label="Home" end />
          </li>
          <li>
            <NavItem to="/explore" label="Explore" />
          </li>
          <li>
            <NavItem to="/settings" label="Settings" />
          </li>
          <li>
            <NavItem to="/about" label="About" />
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
          'font-jost text-xs sm:text-sm font-medium no-underline min-h-[44px] px-1.5 sm:px-2 flex items-center justify-center',
          'transition-colors whitespace-nowrap',
          isActive ? 'text-brass-300 font-semibold' : 'text-white hover:text-brass-300',
        ].join(' ')
      }
      style={{ transitionDuration: 'var(--dur-micro)' }}
    >
      {label}
    </NavLink>
  );
}
