'use client';

import { useEffect } from 'react';
import { Container, Button } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <Container className="grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <AlertTriangle className="mx-auto h-12 w-12 text-accent" />
        <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted-fg">An unexpected error occurred. Please try again.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </Container>
  );
}
