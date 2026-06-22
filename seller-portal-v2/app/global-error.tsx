'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // global-error catches root-layout errors that bypass the per-route
    // error boundary, so reporting here is critical for visibility.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#fafaf9',
          color: '#1c1917',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1rem',
        }}
      >
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            background: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: '0.5rem',
            padding: '2rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1rem', fontWeight: 500, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#78716c', margin: '0 0 1.5rem' }}>
            {error.message || 'A critical error occurred. Please try again.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.6875rem', color: '#a8a29e', margin: '0 0 1.5rem', fontFamily: 'monospace' }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: '#047857',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.375rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
