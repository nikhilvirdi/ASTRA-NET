import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthCode,
  verifyGoogleIdToken,
} from './google-oauth.client.js';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'test-only-fake-google-client-secret';
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

describe('buildGoogleAuthorizationUrl', () => {
  it('builds a well-formed authorization URL with the given client id/redirect/state', () => {
    const url = new URL(
      buildGoogleAuthorizationUrl({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        state: 'abc123',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('state')).toBe('abc123');
  });
});

describe('exchangeGoogleAuthCode', () => {
  it('returns the id_token on a successful exchange', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id_token: 'a-fake-id-token',
            access_token: 'a-fake-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    ) as unknown as typeof fetch;

    const result = await exchangeGoogleAuthCode(
      {
        code: 'a-fake-auth-code',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
      },
      fetchImpl,
    );

    expect(result).toEqual({ idToken: 'a-fake-id-token' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns null on a non-2xx response (e.g. invalid_grant for a reused code)', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })),
    ) as unknown as typeof fetch;

    const result = await exchangeGoogleAuthCode(
      {
        code: 'reused-code',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
      },
      fetchImpl,
    );

    expect(result).toBeNull();
  });

  it('returns null when the response body does not match the expected shape', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 })),
    ) as unknown as typeof fetch;

    const result = await exchangeGoogleAuthCode(
      {
        code: 'a-fake-auth-code',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
      },
      fetchImpl,
    );

    expect(result).toBeNull();
  });

  it('returns null (not a thrown error) when the fetch itself rejects', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error('network error')),
    ) as unknown as typeof fetch;

    const result = await exchangeGoogleAuthCode(
      {
        code: 'a-fake-auth-code',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
      },
      fetchImpl,
    );

    expect(result).toBeNull();
  });
});

describe('verifyGoogleIdToken', () => {
  // A locally-generated key pair stands in for Google's real (network-fetched)
  // signing keys — this test never makes a live call to Google's JWKS endpoint,
  // matching Phase 1's fixture-based (not live-network) testing convention.
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let localJwks: ReturnType<typeof createLocalJWKSet>;

  beforeEach(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    localJwks = createLocalJWKSet({ keys: [{ ...publicJwk, alg: 'RS256', use: 'sig' }] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function signGoogleIdToken(claims: Record<string, unknown>): Promise<string> {
    return new SignJWT({ email_verified: true, ...claims })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setSubject((claims.sub as string | undefined) ?? 'google-user-id-123')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  it('returns the googleId + lowercased email for a validly signed, fully-verified token', async () => {
    const token = await signGoogleIdToken({
      sub: 'google-user-id-123',
      email: 'Person@Example.com',
    });

    const identity = await verifyGoogleIdToken(token, CLIENT_ID, localJwks);

    expect(identity).toEqual({ googleId: 'google-user-id-123', email: 'person@example.com' });
  });

  it('returns null when the email is not marked verified by Google', async () => {
    const token = await signGoogleIdToken({
      sub: 'google-user-id-123',
      email: 'unverified@example.com',
      email_verified: false,
    });

    await expect(verifyGoogleIdToken(token, CLIENT_ID, localJwks)).resolves.toBeNull();
  });

  it('returns null for a token signed by a different (untrusted) key', async () => {
    const otherKeyPair = await generateKeyPair('RS256');
    const token = await new SignJWT({ email: 'person@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setSubject('google-user-id-123')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherKeyPair.privateKey);

    await expect(verifyGoogleIdToken(token, CLIENT_ID, localJwks)).resolves.toBeNull();
  });

  it('returns null when the audience does not match our client id', async () => {
    const token = await new SignJWT({ email: 'person@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('someone-elses-client-id')
      .setSubject('google-user-id-123')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    await expect(verifyGoogleIdToken(token, CLIENT_ID, localJwks)).resolves.toBeNull();
  });

  it('returns null for a malformed token string', async () => {
    await expect(verifyGoogleIdToken('not-a-real-jwt', CLIENT_ID, localJwks)).resolves.toBeNull();
  });
});
