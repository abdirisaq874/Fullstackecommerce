'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { API_URL } from '@/lib/utils';

type State = 'verifying' | 'success' | 'error' | 'missing';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyView />
    </Suspense>
  );
}

function VerifyView() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setState(res.ok ? 'success' : 'error');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirming your email address"
      footer={
        <Link href="/login" className="font-bold text-brand hover:underline">
          Go to sign in
        </Link>
      }
    >
      {state === 'verifying' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-sm font-semibold text-stone-600">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          Verifying your email…
        </div>
      )}
      {state === 'success' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-300/50 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-8 w-8" />
          Your email is verified — thank you! You can head back to the store.
        </div>
      )}
      {state === 'missing' && (
        <div className="rounded-2xl border-2 border-danger/30 bg-danger/5 p-6 text-center text-sm font-semibold text-danger">
          This verification link is missing its token.
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-danger/30 bg-danger/5 p-6 text-center text-sm font-semibold text-danger">
          <XCircle className="h-8 w-8" />
          This link is invalid or has expired. Sign in and request a new verification email.
        </div>
      )}
    </AuthShell>
  );
}
