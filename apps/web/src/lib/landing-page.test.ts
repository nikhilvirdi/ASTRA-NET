import { describe, it, expect } from 'vitest';
import { shouldRedirectToExplore } from './landing-page';

describe('shouldRedirectToExplore', () => {
  it('redirects the root path to Explore when the preference is "explore"', () => {
    expect(shouldRedirectToExplore('/', 'explore')).toBe(true);
  });

  it('does not redirect the root path when the preference is "home" (default, unchanged behavior)', () => {
    expect(shouldRedirectToExplore('/', 'home')).toBe(false);
  });

  it('never redirects a direct visit to /explore itself, regardless of the preference', () => {
    expect(shouldRedirectToExplore('/explore', 'explore')).toBe(false);
    expect(shouldRedirectToExplore('/explore', 'home')).toBe(false);
  });

  it('never redirects any other route, regardless of the preference', () => {
    for (const path of ['/settings', '/status', '/about']) {
      expect(shouldRedirectToExplore(path, 'explore')).toBe(false);
      expect(shouldRedirectToExplore(path, 'home')).toBe(false);
    }
  });
});
