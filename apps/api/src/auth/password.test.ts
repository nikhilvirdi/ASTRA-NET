import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

// Obviously-fake placeholder values only — never anything resembling a
// real credential, per this phase's explicit handling rule.
const PLACEHOLDER_PASSWORD = 'correct-horse-battery-staple';
const WRONG_PLACEHOLDER_PASSWORD = 'incorrect-horse-battery-staple';

describe('hashPassword', () => {
  it('produces an argon2id hash string, never the plaintext itself', async () => {
    const hash = await hashPassword(PLACEHOLDER_PASSWORD);

    expect(hash).not.toBe(PLACEHOLDER_PASSWORD);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash for the same password on each call (unique salt)', async () => {
    const hashOne = await hashPassword(PLACEHOLDER_PASSWORD);
    const hashTwo = await hashPassword(PLACEHOLDER_PASSWORD);

    expect(hashOne).not.toBe(hashTwo);
  });

  it('hashes an empty-string password without throwing', async () => {
    const hash = await hashPassword('');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('hashes a password containing unicode without throwing', async () => {
    const hash = await hashPassword('pässwörd-🔭-plaçeholder');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct plaintext against its own hash', async () => {
    const hash = await hashPassword(PLACEHOLDER_PASSWORD);
    await expect(verifyPassword(hash, PLACEHOLDER_PASSWORD)).resolves.toBe(true);
  });

  it('returns false for an incorrect plaintext', async () => {
    const hash = await hashPassword(PLACEHOLDER_PASSWORD);
    await expect(verifyPassword(hash, WRONG_PLACEHOLDER_PASSWORD)).resolves.toBe(false);
  });

  it('returns false (not a thrown error) for a malformed hash string', async () => {
    await expect(verifyPassword('not-a-real-argon2-hash', PLACEHOLDER_PASSWORD)).resolves.toBe(
      false,
    );
  });

  it('returns false (not a thrown error) for an empty hash string', async () => {
    await expect(verifyPassword('', PLACEHOLDER_PASSWORD)).resolves.toBe(false);
  });
});
