'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useResetPasswordMutation } from '@/lib/api/auth-api';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/lib/schemas/auth';
import { Field, Input } from '@/components/primitives/field';
import { Button } from '@/components/primitives/button';
import { Alert } from '@/components/primitives/alert';

/**
 * Reset-password page.
 *
 * Reads the single-use `token` from the URL (emailed to the user by the
 * forgot-password flow) and POSTs `{ token, newPassword }` to
 * `/auth/reset-password`. On success we bounce to `/login?reset=ok` so the
 * login page can render a success banner.
 *
 * When `token` is missing/blank we render an inline error rather than the
 * form — there's nothing useful the user can do without it, and submitting
 * an empty token would only leak validation timing back to the server.
 *
 * Next.js 14 App Router requires `useSearchParams()` to be wrapped in a
 * `<Suspense>` boundary so the surrounding shell can be statically prerendered
 * while the searchParams-reading child renders client-side.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordFallback() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">Set a new password</h1>
        <p className="text-sm text-stone-500 mt-1">
          Choose a strong password you haven&apos;t used before.
        </p>
      </header>
      <div className="h-48 animate-pulse rounded-lg bg-stone-100" />
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-xl font-medium text-stone-900">
            Reset link invalid
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            We couldn&apos;t find a reset token in this link.
          </p>
        </header>

        <Alert variant="danger" className="mb-6">
          This password-reset link is missing or malformed. Reset links expire
          after a short window — please request a new one.
        </Alert>

        <p className="text-center text-sm text-stone-600">
          <Link
            href="/forgot-password"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) return;
    await resetPassword({ token, newPassword: values.password }).unwrap();
    router.push('/login?reset=ok');
  }

  const submitError = extractErrorMessage(error);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">Set a new password</h1>
        <p className="text-sm text-stone-500 mt-1">
          Choose a strong password you haven&apos;t used before.
        </p>
      </header>

      {submitError && (
        <Alert variant="danger" className="mb-4">
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label="New password"
          required
          hint="At least 8 characters, with upper, lower, and a digit."
          error={errors.password?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Field
          label="Confirm new password"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          )}
          {isLoading ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <p className="text-center text-sm text-stone-600 mt-6">
        <Link
          href="/login"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Pull a sensible message out of an RTK Query error union.
 * Returns `undefined` when there is nothing to display. The global
 * `rtkQueryErrorMiddleware` already toasts the same string, so this inline
 * alert is a soft fallback for users who dismiss the toast quickly.
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
