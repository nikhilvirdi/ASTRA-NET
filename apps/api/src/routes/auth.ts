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

import express, { type Express, type Request, type Response } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
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

export interface AuthRouteDeps {
  prisma: PrismaClient;
  jwtAccessSecret: string;
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

export function registerAuthRoutes(app: Express, deps: AuthRouteDeps): void {
  const { prisma, jwtAccessSecret } = deps;

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

      const now = new Date();
      const accessToken = await signAccessToken(user.id, jwtAccessSecret, now);
      const refreshToken = generateRefreshToken();
      const expiresAt = refreshTokenExpiresAt(now);
      await prisma.session.create({
        data: {
          userId: user.id,
          hashedRefreshToken: hashRefreshToken(refreshToken),
          expiresAt,
          userAgent: req.get('user-agent') ?? null,
        },
      });

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
}
