import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt.js';

// Obviously-fake placeholder secret — never a real credential.
const SECRET = 'test-only-fake-jwt-secret-not-a-real-value';
const OTHER_SECRET = 'a-different-test-only-fake-secret';
const USER_ID = 'user_fakeid123';
const NOW = new Date('2026-07-17T12:00:00Z');

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips: a freshly signed token verifies and yields the same userId', async () => {
    const token = await signAccessToken(USER_ID, SECRET, NOW);
    const payload = await verifyAccessToken(token, SECRET, NOW);

    expect(payload).toEqual({ userId: USER_ID });
  });

  it('is still valid just before the 15-minute expiry', async () => {
    const token = await signAccessToken(USER_ID, SECRET, NOW);
    const almostExpired = new Date(NOW.getTime() + 14 * 60 * 1000);

    const payload = await verifyAccessToken(token, SECRET, almostExpired);
    expect(payload).toEqual({ userId: USER_ID });
  });

  it('returns null once the 15-minute expiry has passed', async () => {
    const token = await signAccessToken(USER_ID, SECRET, NOW);
    const expired = new Date(NOW.getTime() + 16 * 60 * 1000);

    const payload = await verifyAccessToken(token, SECRET, expired);
    expect(payload).toBeNull();
  });

  it('returns null when verified against a different secret', async () => {
    const token = await signAccessToken(USER_ID, SECRET, NOW);
    const payload = await verifyAccessToken(token, OTHER_SECRET, NOW);

    expect(payload).toBeNull();
  });

  it('returns null (not a thrown error) for a malformed token string', async () => {
    const payload = await verifyAccessToken('not-a-real-jwt', SECRET, NOW);
    expect(payload).toBeNull();
  });

  it('returns null for an empty token string', async () => {
    const payload = await verifyAccessToken('', SECRET, NOW);
    expect(payload).toBeNull();
  });

  it('returns null for a validly signed token that has no subject claim', async () => {
    const secretKey = new TextEncoder().encode(SECRET);
    const tokenWithoutSubject = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secretKey);

    const payload = await verifyAccessToken(tokenWithoutSubject, SECRET, NOW);
    expect(payload).toBeNull();
  });
});
