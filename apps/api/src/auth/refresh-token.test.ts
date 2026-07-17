import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  refreshTokenMatches,
} from './refresh-token.js';

describe('generateRefreshToken', () => {
  it('produces a non-empty, URL-safe string', () => {
    const token = generateRefreshToken();
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a different token on each call', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });
});

describe('hashRefreshToken', () => {
  it('is deterministic: the same token always hashes the same way', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('produces a 64-character hex string (SHA-256 digest)', () => {
    const hash = hashRefreshToken(generateRefreshToken());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different tokens', () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(
      hashRefreshToken(generateRefreshToken()),
    );
  });
});

describe('refreshTokenMatches', () => {
  it('returns true when the presented token hashes to the stored hash', () => {
    const token = generateRefreshToken();
    const storedHash = hashRefreshToken(token);

    expect(refreshTokenMatches(storedHash, token)).toBe(true);
  });

  it('returns false for a different presented token', () => {
    const storedHash = hashRefreshToken(generateRefreshToken());
    const wrongToken = generateRefreshToken();

    expect(refreshTokenMatches(storedHash, wrongToken)).toBe(false);
  });

  it('returns false (not a thrown error) when the stored hash is a different length than a real SHA-256 digest', () => {
    const token = generateRefreshToken();
    expect(refreshTokenMatches('not-a-real-hash', token)).toBe(false);
  });

  it('returns false when the stored hash is empty', () => {
    const token = generateRefreshToken();
    expect(refreshTokenMatches('', token)).toBe(false);
  });
});

describe('refreshTokenExpiresAt', () => {
  it('returns exactly 30 days after the given instant', () => {
    const now = new Date('2026-07-17T12:00:00Z');
    const expected = new Date('2026-08-16T12:00:00Z');

    expect(refreshTokenExpiresAt(now)).toEqual(expected);
  });
});
