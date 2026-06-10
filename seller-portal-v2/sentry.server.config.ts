/**
 * Sentry server-side configuration.
 *
 * Initialised in the Node.js runtime (API routes, server components, RSC
 * actions). Prefers a server-only SENTRY_DSN and falls back to
 * NEXT_PUBLIC_SENTRY_DSN so a single DSN works across both environments.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
