import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function Footer(): React.ReactElement | null {
  const location = useLocation();
  const isExplore = location.pathname === '/explore';

  if (isExplore) return null;

  return (
    <footer className="w-full border-t border-brass-500/30 bg-transparent h-12 flex items-center justify-between px-8 mt-auto">
      <div className="flex items-center opacity-70">
        <img src="/logo.svg" alt="ASTRANET" className="h-4 w-auto object-contain grayscale" />
      </div>
      <NavLink
        to="/status"
        className={({ isActive }) =>
          [
            'type-micro no-underline transition-colors hover:text-sky-100',
            isActive ? 'text-brass-300' : 'text-sky-400',
          ].join(' ')
        }
      >
        SYSTEM STATUS
      </NavLink>
    </footer>
  );
}
