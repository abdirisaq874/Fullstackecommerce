'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/primitives/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Forward the rendered error to Sentry so we have a stack trace alongside
    // the digest. Sentry is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-lg shadow-sm">
        <div className="px-6 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 grid place-items-center mx-auto mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" strokeWidth={2} />
          </div>
          <h1 className="text-base font-medium text-stone-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto break-words">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error.digest && (
            <p className="text-2xs text-stone-400 mb-6 font-mono">
              Ref: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <Button variant="primary" onClick={() => reset()}>
              Try again
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300 focus-visible:ring-stone-400 px-3 py-1.5 text-sm gap-1.5"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
