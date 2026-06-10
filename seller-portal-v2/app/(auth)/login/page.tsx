'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useLoginMutation, useLazyGetMeQuery } from '@/lib/api/auth-api';
import { useAppDispatch } from '@/lib/api/store';
import { setCredentials } from '@/lib/store/auth-slice';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { Field, Input } from '@/components/primitives/field';
import { Button } from '@/components/primitives/button';
import { Alert } from '@/components/primitives/alert';

/**
 * Login page.
 *
 * Submits `{ email, password }` to `POST /auth/login` via RTK Query. On success
 * we hydrate the auth slice (which mirrors tokens to localStorage and drops
 * the `sellerPortal.hasSession` cookie consumed by middleware.ts), then push
 * the user to `?from=` if present (set by middleware on protected redirects)
 * or `/dashboard` by default.
 *
 * The backend's `/auth/login` response carries an optional `user` field; if
 * it's absent (older backend builds) we fall back to `GET /users/me` to make
 * the auth slice fully populated before navigating away.
 *
 * Next.js 14 App Router requires `useSearchParams()` to be wrapped in a
 * `<Suspense>` boundary so the surrounding shell can be statically prerendered
 * while the searchParams-reading child renders client-side.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormFallback() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">Welcome back</h1>
        <p className="text-sm text-stone-500 mt-1">
          Sign in to manage your store, orders and inventory.
        </p>
      </header>
      <div className="h-48 animate-pulse rounded-lg bg-stone-100" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const [login, { isLoading: isLoggingIn, error }] = useLoginMutation();
  const [fetchMe, { isFetching: isFetchingMe }] = useLazyGetMeQuery();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const isSubmitting = isLoggingIn || isFetchingMe;

  async function onSubmit(values: LoginFormValues) {
    const tokens = await login(values).unwrap();

    // base-api.ts's prepareHeaders reads the access token from localStorage on
    // every outgoing request, so if we need to follow up with `/users/me` we
    // must persist the token *before* that call. Writing directly here (instead
    // of dispatching setCredentials with a null user) avoids a flicker where
    // selectCurrentUser briefly returns null between two dispatches.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sellerPortal.accessToken', tokens.accessToken);
      window.localStorage.setItem('sellerPortal.refreshToken', tokens.refreshToken);
    }

    const user = tokens.user ?? (await fetchMe().unwrap());

    dispatch(
      setCredentials({
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          role: user.role,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
    );

    const from = searchParams.get('from');
    router.push(from && from.startsWith('/') ? from : '/dashboard');
  }

  // Extract a human-readable error for the inline alert; the global
  // rtkQueryErrorMiddleware also surfaces this as a toast, so this is
  // intentionally a soft fallback.
  const submitError = extractErrorMessage(error);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">Welcome back</h1>
        <p className="text-sm text-stone-500 mt-1">
          Sign in to manage your store, orders and inventory.
        </p>
      </header>

      {submitError && (
        <Alert variant="danger" className="mb-4">
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" required error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" required error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <div className="flex items-center justify-end -mt-1">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          )}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-stone-600 mt-6">
        New to Gaarsii?{' '}
        <Link
          href="/register"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Create a seller account
        </Link>
      </p>
    </div>
  );
}

/**
 * Pull a sensible message out of an RTK Query error union.
 * Returns `undefined` when there is nothing to display.
 */
function extractErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as Record<string, unknown>;
  const data = e.data;
  if (data && typeof data === 'object') {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.length > 0) return String(message[0]);
  }
  if (typeof e.error === 'string' && e.error.trim()) return e.error;
  return undefined;
}
