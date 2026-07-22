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
import { hashPassword } from '../auth/password.js';

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

export interface AuthRouteDeps {
  prisma: PrismaClient;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function registerAuthRoutes(app: Express, deps: AuthRouteDeps): void {
  const { prisma } = deps;

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
      console.error(
        `[auth] signup failed unexpectedly: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      res.status(500).json({ error: 'internal error' });
    }
  });
}
