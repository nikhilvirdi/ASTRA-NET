/**
 * `/api/auth/*` routes (WORKPLAN.md Phase 5). Thin HTTP wrappers around
 * the already-tested auth primitives (`../auth/password.js`,
 * `../auth/jwt.js`, `../auth/refresh-token.js`) plus the injected Prisma
 * Client — validation at the boundary with Zod (WORKPLAN.md rule #6),
 * DB reads/writes here at the route layer, never inside the primitives.
 *
 * Secrets discipline (WORKPLAN.md Phase 5 agent expectations): no
 * handler ever logs or echoes a plaintext password, a password hash, or
 * a token. Error responses are static strings; unexpected errors log
 * only the error's name/code, never its message or the request body.
 */

import { randomBytes } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signAccessToken } from '../auth/jwt.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from '../auth/refresh-token.js';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../auth/refresh-cookie.js';
import {
  clearOAuthStateCookie,
  readOAuthStateCookie,
  setOAuthStateCookie,
} from '../auth/oauth-state-cookie.js';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthCode as defaultExchangeGoogleAuthCode,
  verifyGoogleIdToken as defaultVerifyGoogleIdToken,
  type GoogleIdentity,
} from '../clients/google/index.js';
import { requireAuth } from '../auth/require-auth.js';

/**
 * No doc pins a password policy, so this is deliberately minimal: a
 * floor against trivially guessable passwords and a ceiling so a
 * megabyte "password" can't be fed to Argon2 (a memory-hard function)
 * as a cheap DoS. Not gold-plated further (no character-class rules).
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Email is lowercased at the boundary so `User.email`'s unique index
 * also enforces case-insensitive uniqueness — `Foo@x.com` and
 * `foo@x.com` are the same account, matching how mail providers treat
 * addresses in practice.
 */
const SignupBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/**
 * Login deliberately doesn't enforce the 8-char floor: that's a
 * signup-time policy, not a login validity rule, and a short-password
 * account (if one somehow exists) should still fail via the normal
 * "invalid email or password" path, not a distinct 400. The 128-char
 * ceiling still applies — `verifyPassword` runs the same memory-hard
 * Argon2 computation as `hashPassword`, so it's the same DoS surface.
 */
const LoginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

/**
 * Additive only (ARCHITECTURE.md §3 G: "never a prerequisite") — the
 * whole app must still boot and every other auth route must still work
 * with this left undefined, which is why `index.ts` reads these three
 * env vars optionally rather than via `requireEnv`.
 */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Where the browser is sent after the flow completes (or fails) — the frontend's own origin. */
  webOrigin: string;
}

export interface AuthRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
  googleOAuth?: GoogleOAuthConfig;
  /** Overridable for tests only — real network calls to Google, never mocked in production. */
  exchangeGoogleAuthCode?: typeof defaultExchangeGoogleAuthCode;
  verifyGoogleIdToken?: typeof defaultVerifyGoogleIdToken;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Logs only the error's name/code — never its message, which can embed request data. */
function logUnexpectedAuthError(routeLabel: string, error: unknown): void {
  console.error(
    `[auth] ${routeLabel} failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
  );
}

/** Issues a fresh access token + refresh token and stores the latter's hash as a new Session row. */
async function createSessionAndTokens(
  prisma: PrismaClient,
  userId: string,
  jwtAccessSecret: string,
  now: Date,
  userAgent: string | null,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const accessToken = await signAccessToken(userId, jwtAccessSecret, now);
  const refreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiresAt(now);
  await prisma.session.create({
    data: { userId, hashedRefreshToken: hashRefreshToken(refreshToken), expiresAt, userAgent },
  });
  return { accessToken, refreshToken, expiresAt };
}

/**
 * Finds the User this verified Google identity belongs to, linking it
 * onto an existing email-matched account (password-based or a returning
 * Google user) or creating a brand-new one. `identity.email` is only
 * ever a Google-verified (`email_verified: true`) address by the time
 * it reaches here — see `google-oauth.client.ts`.
 */
async function findOrCreateGoogleUser(
  prisma: PrismaClient,
  identity: GoogleIdentity,
): Promise<User> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: identity.googleId }, { email: identity.email }] },
  });
  if (existing !== null) {
    if (existing.googleId === identity.googleId) return existing;
    return prisma.user.update({
      where: { id: existing.id },
      data: { googleId: identity.googleId },
    });
  }

  try {
    return await prisma.user.create({
      data: { email: identity.email, googleId: identity.googleId },
    });
  } catch (error) {
    // Concurrent first-time-login race: another request created this
    // row between our findFirst and this create. Re-fetch by googleId
    // (guaranteed unique to this Google account) rather than fail.
    if (isUniqueConstraintViolation(error)) {
      const user = await prisma.user.findUnique({ where: { googleId: identity.googleId } });
      if (user !== null) return user;
    }
    throw error;
  }
}

export function registerAuthRoutes(app: Express, deps: AuthRouteDeps): void {
  const { prisma, jwtAccessSecret, googleOAuth } = deps;
  const exchangeGoogleAuthCode = deps.exchangeGoogleAuthCode ?? defaultExchangeGoogleAuthCode;
  const verifyGoogleIdToken = deps.verifyGoogleIdToken ?? defaultVerifyGoogleIdToken;

  // express.json() is scoped to these routes rather than app-wide: no
  // other current route accepts a body, and this keeps their behavior
  // byte-for-byte unchanged.
  app.post('/api/auth/signup', express.json(), async (req: Request, res: Response) => {
    const parsed = SignupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: `email must be a valid address and password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
      });
      return;
    }
    const { email, password } = parsed.data;

    const passwordHash = await hashPassword(password);
    try {
      const user = await prisma.user.create({ data: { email, passwordHash } });
      res.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
      // Concurrent-signup safe: uniqueness is enforced by the DB index,
      // not a racy pre-check with findUnique.
      if (isUniqueConstraintViolation(error)) {
        res.status(409).json({ error: 'an account with this email already exists' });
        return;
      }
      logUnexpectedAuthError('signup', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * A generic "invalid email or password" covers both a nonexistent
   * account and a wrong password for a real one — never letting the
   * response distinguish the two would-be-enumerable cases. An
   * OAuth-only account (`passwordHash === null`) fails the same way:
   * `validPassword` short-circuits to `false` without ever calling
   * `verifyPassword` on a null hash.
   */
  app.post('/api/auth/login', express.json(), async (req: Request, res: Response) => {
    const parsed = LoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const { email, password } = parsed.data;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      const passwordHash = user?.passwordHash;
      const validPassword = passwordHash != null && (await verifyPassword(passwordHash, password));
      if (user === null || !validPassword) {
        res.status(401).json({ error: 'invalid email or password' });
        return;
      }

      const { accessToken, refreshToken, expiresAt } = await createSessionAndTokens(
        prisma,
        user.id,
        jwtAccessSecret,
        new Date(),
        req.get('user-agent') ?? null,
      );

      setRefreshTokenCookie(res, refreshToken, expiresAt);
      res.status(200).json({ accessToken, user: { id: user.id, email: user.email } });
    } catch (error) {
      logUnexpectedAuthError('login', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * Idempotent and cookie-driven, not access-token-gated: the refresh
   * cookie is itself the credential being revoked, and a client whose
   * 15-minute access token already expired must still be able to log
   * out. No cookie / no matching Session is not an error — logout's
   * job is "make sure this session is gone," which is already true.
   */
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const presentedToken = readRefreshTokenCookie(req);
    try {
      if (presentedToken !== null) {
        // deleteMany (not delete) so a token that doesn't match any row
        // — already logged out, already rotated, or never valid — is a
        // clean no-op rather than a thrown P2025.
        await prisma.session.deleteMany({
          where: { hashedRefreshToken: hashRefreshToken(presentedToken) },
        });
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({ loggedOut: true });
    } catch (error) {
      logUnexpectedAuthError('logout', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * Rotation, not reuse: every successful refresh deletes the presented
   * session row and creates a brand-new one with a brand-new hashed
   * token, inside one transaction so a mid-flight crash can't either
   * accept the old token twice or silently drop the session. An
   * already-rotated (old) refresh token no longer matches any row —
   * `hashedRefreshToken` is unique, so once it's deleted, a replay
   * lookup finds nothing and fails closed, same as a bogus token.
   */
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const presentedToken = readRefreshTokenCookie(req);
    if (presentedToken === null) {
      res.status(401).json({ error: 'no refresh token presented' });
      return;
    }

    const now = new Date();
    try {
      const session = await prisma.session.findUnique({
        where: { hashedRefreshToken: hashRefreshToken(presentedToken) },
      });

      if (session === null || session.expiresAt <= now) {
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'invalid or expired refresh token' });
        return;
      }

      const newRefreshToken = generateRefreshToken();
      const newExpiresAt = refreshTokenExpiresAt(now);
      await prisma.$transaction([
        prisma.session.delete({ where: { id: session.id } }),
        prisma.session.create({
          data: {
            userId: session.userId,
            hashedRefreshToken: hashRefreshToken(newRefreshToken),
            expiresAt: newExpiresAt,
            userAgent: req.get('user-agent') ?? null,
          },
        }),
      ]);

      const accessToken = await signAccessToken(session.userId, jwtAccessSecret, now);
      setRefreshTokenCookie(res, newRefreshToken, newExpiresAt);
      res.status(200).json({ accessToken });
    } catch (error) {
      logUnexpectedAuthError('refresh', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * WORKPLAN.md Phase 6's final task — delete-my-data. Deleting the
   * `User` row itself, not explicit per-table deletes, per `SCHEMA.md`'s
   * unambiguous "deleting a User cascades to their Sessions, Locations,
   * SkyLogEntries, and Predictions... cascade is the intended behavior,
   * not soft-delete flags" — the `onDelete: Cascade` FKs already defined
   * on all four child models (`prisma/schema.prisma`) do the actual
   * removal. Logged in `DECISIONS.md`: this reads as full account
   * deletion, which is a stronger behavior than `ARCHITECTURE.md` §7 /
   * WORKPLAN.md's own task phrasing ("removal of a user's locations +
   * log + predictions") literally describes — SCHEMA.md is the more
   * specific, mechanism-level locked doc, so it wins.
   *
   * `deleteMany` (not `delete`), matching `logout`'s own idiom: a second
   * call with the same still-valid (DB-free-verified) access token after
   * the User is already gone is a clean no-op, not a thrown P2025.
   * Session is gone with it, so the refresh cookie is cleared too —
   * same as logout, since there is no session left for it to name.
   */
  app.delete(
    '/api/auth/account',
    requireAuth({ jwtAccessSecret }),
    async (req: Request, res: Response) => {
      const userId = req.userId as string;
      try {
        await prisma.user.deleteMany({ where: { id: userId } });
        clearRefreshTokenCookie(res);
        res.status(200).json({ deleted: true });
      } catch (error) {
        logUnexpectedAuthError('delete-account', error);
        res.status(500).json({ error: 'internal error' });
      }
    },
  );

  /**
   * The first route `requireAuth` actually protects (WORKPLAN.md Phase
   * 5's DoD: "...and access a protected route"). Deliberately minimal —
   * a "who am I" endpoint any authed client needs regardless of Phase
   * 6's specific per-user features, not a preview of those features.
   */
  app.get('/api/auth/me', requireAuth({ jwtAccessSecret }), async (req: Request, res: Response) => {
    const userId = req.userId;
    if (userId === undefined) {
      // Unreachable in practice — requireAuth always sets this before
      // calling next() — but narrows the type without a non-null assertion.
      res.status(401).json({ error: 'invalid or expired access token' });
      return;
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user === null) {
        res.status(401).json({ error: 'user no longer exists' });
        return;
      }
      res.status(200).json({ id: user.id, email: user.email });
    } catch (error) {
      logUnexpectedAuthError('me', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  /**
   * Step 1 of the additive Google OAuth path (ARCHITECTURE.md §3 G):
   * redirects the browser to Google's consent screen. The CSRF `state`
   * value is generated here and stashed in a short-lived cookie so the
   * callback can confirm the response actually came from a flow this
   * server initiated, not a forged redirect.
   */
  app.get('/api/auth/google', (_req: Request, res: Response) => {
    if (googleOAuth === undefined) {
      res.status(404).json({ error: 'Google OAuth is not configured' });
      return;
    }
    const state = randomBytes(16).toString('base64url');
    setOAuthStateCookie(res, state);
    res.redirect(
      buildGoogleAuthorizationUrl({
        clientId: googleOAuth.clientId,
        redirectUri: googleOAuth.redirectUri,
        state,
      }),
    );
  });

  /**
   * Step 2: Google redirects the browser back here with `?code=&state=`.
   * Every failure path (state mismatch, exchange failure, identity
   * verification failure, unexpected error) redirects to the frontend's
   * login page with a generic error flag rather than a raw JSON 4xx/5xx
   * — a real browser lands here mid-navigation with no way to read a
   * JSON body. On success, the access token travels in the redirect's
   * URL *fragment* (never a query string), which browsers never send to
   * any server — the SPA reads it client-side. The refresh token is set
   * as the same httpOnly cookie every other route uses, exactly as if
   * this had been a normal login.
   */
  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    if (googleOAuth === undefined) {
      res.status(404).json({ error: 'Google OAuth is not configured' });
      return;
    }
    const failureRedirect = (): void => {
      clearOAuthStateCookie(res);
      res.redirect(`${googleOAuth.webOrigin}/login?error=oauth_failed`);
    };

    const presentedState = readOAuthStateCookie(req);
    const { code, state } = req.query;
    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      presentedState === null ||
      state !== presentedState
    ) {
      failureRedirect();
      return;
    }

    try {
      const tokenResult = await exchangeGoogleAuthCode({
        code,
        clientId: googleOAuth.clientId,
        clientSecret: googleOAuth.clientSecret,
        redirectUri: googleOAuth.redirectUri,
      });
      if (tokenResult === null) {
        failureRedirect();
        return;
      }

      const identity = await verifyGoogleIdToken(tokenResult.idToken, googleOAuth.clientId);
      if (identity === null) {
        failureRedirect();
        return;
      }

      const user = await findOrCreateGoogleUser(prisma, identity);
      const { accessToken, refreshToken, expiresAt } = await createSessionAndTokens(
        prisma,
        user.id,
        jwtAccessSecret,
        new Date(),
        req.get('user-agent') ?? null,
      );

      clearOAuthStateCookie(res);
      setRefreshTokenCookie(res, refreshToken, expiresAt);
      res.redirect(
        `${googleOAuth.webOrigin}/auth/callback#accessToken=${encodeURIComponent(accessToken)}`,
      );
    } catch (error) {
      logUnexpectedAuthError('google-callback', error);
      failureRedirect();
    }
  });
}
