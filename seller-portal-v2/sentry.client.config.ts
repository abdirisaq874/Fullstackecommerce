/**
 * Sentry client-side configuration.
 *
 * Initialised on every page load in the browser. The DSN is read from
 * NEXT_PUBLIC_SENTRY_DSN; if unset, Sentry is effectively disabled and the
 * SDK becomes a no-op.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Capture 10% of transactions for performance monitoring.
  tracesSampleRate: 0.1,
  // Do not record session replays for normal sessions.
  replaysSessionSampleRate: 0.0,
  // Always record a replay when an error occurs.
  replaysOnErrorSampleRate: 1.0,
});
