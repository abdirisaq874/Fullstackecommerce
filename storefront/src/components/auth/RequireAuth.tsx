'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button, Container, EmptyState } from '@/components/ui';
import { useAppSelector } from '@/store';

export function RequireAuth({ children, message }: { children: React.ReactNode; message?: string }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const pathname = usePathname();

  if (!hydrated) {
    return (
      <Container className="py-20">
        <div className="skeleton mx-auto h-40 max-w-md" />
      </Container>
    );
  }

  if (!token) {
    return (
      <Container className="py-20">
        <EmptyState
          icon={<Lock className="h-10 w-10" />}
          title="Please sign in"
          description={message || 'You need an account to access this page.'}
          action={
            <div className="flex gap-2">
              <Link href={`/login?redirect=${encodeURIComponent(pathname)}`}><Button>Sign in</Button></Link>
              <Link href={`/register?redirect=${encodeURIComponent(pathname)}`}><Button variant="outline">Create account</Button></Link>
            </div>
          }
        />
      </Container>
    );
  }

  return <>{children}</>;
}
