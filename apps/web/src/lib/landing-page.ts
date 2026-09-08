import type { DefaultLandingPage } from '@/store';

/**
 * Whether the app's one-time root-path redirect should send this session to
 * /explore instead of the Brief page.
 *
 * Deliberately narrow: only the literal root path ('/') is ever redirected.
 * A direct visit to /explore, /settings, or any other route always renders
 * that real route regardless of this preference — the setting decides what
 * "/" resolves to, not which pages exist or are reachable. The caller (see
 * App.tsx) applies this exactly once, in a mount-only effect, so navigating
 * back to "/" later (the nav bar's Home link, the wordmark) always shows the
 * real Brief page — the preference affects only the very first load of a
 * session, never ongoing navigation.
 */
export function shouldRedirectToExplore(
  pathname: string,
  defaultLandingPage: DefaultLandingPage,
): boolean {
  return pathname === '/' && defaultLandingPage === 'explore';
}
