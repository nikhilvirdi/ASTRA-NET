/**
 * Password hashing (Phase 5, ARCHITECTURE.md §3 G / §2's locked Argon2
 * choice). Thin wrapper over the `argon2` package's own defaults
 * (argon2id, 64 MiB memory cost, 3 time cost, parallelism 4) — no
 * project-specific override, since no doc pins different parameters and
 * the library's defaults already track current OWASP guidance.
 *
 * Zero I/O beyond the hashing computation itself (no DB, no network), so
 * this is testable the same way the pure engines are — real input in,
 * real output out.
 */

import * as argon2 from 'argon2';

/** Hashes a plaintext password. Never returns or logs the plaintext. */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext);
}

/**
 * Verifies a plaintext password against a stored Argon2 hash. Returns
 * `false` (not a thrown error) for any mismatch, including a hash string
 * that isn't a valid Argon2 hash at all — a malformed stored value should
 * fail auth, not crash the request.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
