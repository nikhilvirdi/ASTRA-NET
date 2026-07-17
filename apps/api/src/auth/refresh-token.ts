/**
 * Refresh-token generation, hashing, and comparison (Phase 5,
 * ARCHITECTURE.md §3 G / SCHEMA.md's Session model).
 *
 * Deliberately an opaque high-entropy random string, not a JWT: the
 * refresh token's actual trust boundary is "does its hash match a live,
 * unexpired `Session` row" — a DB lookup the route layer performs later,
 * not a cryptographic signature this module verifies. A signed/parseable
 * JWT structure would add complexity (claims, algorithms, expiry
 * encoded twice — once in the token, once in the row) with no security
 * benefit over a plain random value, since revocation already requires
 * hitting the database regardless of token format. See DECISIONS.md.
 *
 * Hashed with SHA-256, not Argon2: Argon2 (`password.ts`) is a slow KDF
 * that exists specifically to resist brute-forcing a *low-entropy,
 * human-guessable* secret. A refresh token is already 256 bits of CSPRNG
 * output — nothing to brute-force — so a slow KDF here only adds latency
 * on every refresh with no corresponding security gain. See
 * DECISIONS.md.
 *
 * Zero I/O, no DB — the same "testable in isolation, DB read/write
 * happens at the route layer later" shape as `password.ts`.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const REFRESH_TOKEN_BYTES = 32; // 256 bits of entropy
/** ARCHITECTURE.md §3 G — 30-day refresh token. */
const REFRESH_TOKEN_TTL_DAYS = 30;

/** The plaintext token handed to the client (httpOnly cookie) — never stored as-is. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** What actually gets stored in `Session.hashedRefreshToken`. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compares a presented (cookie) token against a stored hash without a
 * variable-time string compare, so a byte-by-byte early-exit comparison
 * can't leak how much of the hash matched. Length-checks first since
 * `timingSafeEqual` throws (rather than returning `false`) on
 * mismatched buffer lengths.
 */
export function refreshTokenMatches(storedHash: string, presentedToken: string): boolean {
  const presentedHash = hashRefreshToken(presentedToken);
  const storedBuffer = Buffer.from(storedHash, 'hex');
  const presentedBuffer = Buffer.from(presentedHash, 'hex');

  if (storedBuffer.length !== presentedBuffer.length) return false;
  return timingSafeEqual(storedBuffer, presentedBuffer);
}

export function refreshTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
