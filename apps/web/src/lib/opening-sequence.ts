const VISITED_KEY = 'astranet:explore:visited';

export function hasSeenOpeningSequence(): boolean {
  try {
    return window.localStorage.getItem(VISITED_KEY) !== null;
  } catch {
    // Storage unavailable (privacy mode) — play the sequence; it degrades fine.
    return false;
  }
}

export function markOpeningSequenceSeen(): void {
  try {
    window.localStorage.setItem(VISITED_KEY, new Date().toISOString());
  } catch {
    // Best effort only.
  }
}
