import { z } from 'zod';

/**
 * Google's token endpoint (`https://oauth2.googleapis.com/token`) response
 * for the authorization-code grant. Only the fields this client actually
 * uses are validated — Google's real response includes more (`scope`,
 * etc.) that Zod's default (non-strict) object parsing simply ignores.
 */
export const GoogleTokenResponseSchema = z.object({
  id_token: z.string().min(1),
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number(),
});
