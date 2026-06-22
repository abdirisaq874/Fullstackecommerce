/**
 * Type-safe runtime environment configuration for seller-portal-v2.
 *
 * Why this exists:
 *  - `process.env` values are typed as `string | undefined`, which forces every
 *    call-site to defensively check for missing values. By parsing the env
 *    through a zod schema at module load time we get a single, strongly-typed
 *    `env` object that the rest of the app can rely on.
 *  - Because `schema.parse(process.env)` runs at import time, the process
 *    fails fast at boot if a required variable is missing or malformed,
 *    rather than crashing deep inside a feature at runtime.
 *
 * Usage:
 *   import { env } from '@/lib/config/env';
 *   fetch(`${env.NEXT_PUBLIC_API_URL}/products`);
 *
 * Note: only `NEXT_PUBLIC_*` variables are accessible in client bundles. The
 * keys here are all client-safe by design.
 */
import { z } from 'zod';

const envSchema = z.object({
  /** Backend API base URL (e.g. http://localhost:3000/api/v1). */
  NEXT_PUBLIC_API_URL: z.string().url(),
  /** Public URL this Next.js app is served from. */
  NEXT_PUBLIC_APP_URL: z.string().url(),
  /** Optional Sentry DSN for client-side error tracking. */
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  /** Optional Stripe publishable key (pk_test_... / pk_live_...). */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

/**
 * Validated, strongly-typed environment object.
 *
 * Throws at module load if validation fails so misconfiguration is caught
 * at boot rather than at first request.
 *
 * IMPORTANT: each NEXT_PUBLIC_* key must be referenced *individually* below.
 * Next.js's webpack only inlines `process.env.NEXT_PUBLIC_FOO` when it sees
 * that literal access pattern at build time. Passing the whole `process.env`
 * object to `parse()` would receive an empty `{}` on the client bundle.
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

export type Env = z.infer<typeof envSchema>;

// Warn (don't crash) if Sentry isn't configured in production. We keep the
// DSN optional so previews and local dev can run without a Sentry project,
// but production builds without a DSN almost always indicate a misconfig.
if (process.env.NODE_ENV === 'production' && !env.NEXT_PUBLIC_SENTRY_DSN) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] NEXT_PUBLIC_SENTRY_DSN is not set in production; client-side errors will not be reported to Sentry.',
  );
}
