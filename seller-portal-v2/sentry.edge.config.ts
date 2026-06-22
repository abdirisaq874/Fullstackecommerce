/**
 * Sentry edge-runtime configuration.
 *
 * Initialised in the Edge runtime (middleware, edge route handlers). Mirrors
 * the server config so middleware errors are reported alongside server
 * errors in the same Sentry project.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
