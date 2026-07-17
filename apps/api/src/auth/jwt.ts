/**
 * Access-token issuance/verification (Phase 5, ARCHITECTURE.md §3 G's
 * 15-minute access token). Uses `jose` over `jsonwebtoken` — see
 * DECISIONS.md.
 *
 * `now` is always an explicit parameter, never read internally — same
 * discipline as the pure engines (WORKPLAN.md rule #4), and it's what
 * makes expiry genuinely unit-testable without a real 15-minute wait or
 * a global-clock mock. Both `sign` and `verify` derive `iat`/`exp` from
 * the same injected instant rather than letting `jose` read the system
 * clock on its own.
 *
 * Refresh tokens are handled separately in `refresh-token.ts` — they are
 * deliberately *not* JWTs (see that file's header comment).
 */

import { SignJWT, jwtVerify } from 'jose';

/** ARCHITECTURE.md §3 G — 15-minute access token. */
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  userId: string;
}

export async function signAccessToken(userId: string, secret: string, now: Date): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secretKey);
}

/**
 * Returns `null` for any verification failure — bad signature, malformed
 * token, expired token, wrong secret — never throws. A protected route
 * should treat "couldn't verify" as one uniform 401 case, not a set of
 * exception types to catch individually.
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now: Date,
): Promise<AccessTokenPayload | null> {
  const secretKey = new TextEncoder().encode(secret);
  try {
    const { payload } = await jwtVerify(token, secretKey, { currentDate: now });
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
