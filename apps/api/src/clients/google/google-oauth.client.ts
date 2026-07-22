/**
 * Google OAuth 2.0 (authorization-code flow, WORKPLAN.md Phase 5's
 * additive login path). Three isolated pieces, mirroring Phase 1's
 * client shape (fetch/validate, injectable dependencies, never throws
 * from the caller's perspective) even though this isn't a Phase-1 data
 * client — an external network boundary is an external network
 * boundary.
 *
 * Deliberate deviation from Phase 1's "documented fallback value on
 * failure" convention: a failed OAuth exchange has no sensible
 * fallback (there's no degraded-but-still-useful login), so failures
 * here resolve to `null` — "this identity could not be established" —
 * for the route layer to turn into a clean rejection, not a card that
 * silently shows "unavailable."
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { GoogleTokenResponseSchema } from './google-oauth.schemas.js';
import type { GoogleIdentity } from './google-oauth.types.js';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
/** Google's ID tokens use either form across documentation/history; accept both. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;

export interface BuildGoogleAuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
}

export function buildGoogleAuthorizationUrl(params: BuildGoogleAuthorizationUrlParams): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', params.state);
  return url.toString();
}

export interface ExchangeGoogleAuthCodeParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Exchanges a one-time authorization code for Google's ID token.
 * Deliberately a single attempt, no retry-with-backoff (unlike every
 * Phase 1 client): an authorization code is single-use, so retrying
 * after a response is lost/errored risks a confusing `invalid_grant`
 * on the retry even if the first attempt actually succeeded server-side.
 */
export async function exchangeGoogleAuthCode(
  params: ExchangeGoogleAuthCodeParams,
  fetchImpl: typeof fetch = fetch,
): Promise<{ idToken: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_EXCHANGE_TIMEOUT_MS);

  try {
    const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const parsed = GoogleTokenResponseSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    return { idToken: parsed.data.id_token };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let cachedGoogleJwks: JWTVerifyGetKey | undefined;
function defaultGoogleJwks(): JWTVerifyGetKey {
  cachedGoogleJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return cachedGoogleJwks;
}

/**
 * Verifies a Google-issued ID token's signature against Google's own
 * published JWKS (not the userinfo endpoint — a verified signature is
 * the actual trust boundary; no extra network round trip needed once
 * the token itself is checked). `jwks` is injectable so tests can
 * verify against a locally-generated key pair instead of Google's real
 * (network-fetched) keys.
 *
 * Returns `null` — never throws — for any verification failure,
 * including an unverified email: Google can issue an ID token for an
 * email it hasn't confirmed ownership of, and this app's User.email
 * uniqueness/account-linking logic must not trust an unverified one.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  jwks: JWTVerifyGetKey = defaultGoogleJwks(),
): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    if (typeof payload.sub !== 'string') return null;
    if (typeof payload.email !== 'string' || payload.email_verified !== true) return null;
    return { googleId: payload.sub, email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}
