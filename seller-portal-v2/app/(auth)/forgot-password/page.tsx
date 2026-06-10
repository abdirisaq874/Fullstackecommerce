'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useForgotPasswordMutation } from '@/lib/api/auth-api';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/lib/schemas/auth';
import { Field, Input } from '@/components/primitives/field';
import { Button } from '@/components/primitives/button';
import { Alert } from '@/components/primitives/alert';

/**
 * Forgot-password page.
 *
 * Collects an email and POSTs it to `/auth/forgot-password`. We deliberately
 * surface the *same* generic confirmation regardless of whether the email
 * exists (or even whether the request succeeded), so this page cannot be used
 * as an account-enumeration oracle.
 *
 * The backend already returns a generic 200 in either case; this UI mirrors
 * that contract on the client.
 */
export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    // We intentionally swallow errors here: the success message is generic
    // and must look identical for known/unknown emails (and even transient
    // failures) to avoid leaking account existence.
    try {
      await forgotPassword({ email: values.email }).unwrap();
    } catch {
      // ignore — generic confirmation is shown either way
    }
    setSubmittedEmail(values.email);
  }

  if (submittedEmail) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-xl font-medium text-stone-900">Check your inbox</h1>
          <p className="text-sm text-stone-500 mt-1">
            We&apos;ve processed your request.
          </p>
        </header>

        <Alert variant="success" className="mb-6">
          If an account exists for that email, we sent you a link to reset your
          password. The link will expire shortly for your security.
        </Alert>

        <p className="text-sm text-stone-600">
          Didn&apos;t get an email? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            try another address
          </button>
          .
        </p>

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

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">Forgot password</h1>
        <p className="text-sm text-stone-500 mt-1">
          Enter the email associated with your account and we&apos;ll send you a
          reset link.
        </p>
      </header>

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
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm text-stone-600 mt-6">
        Remembered your password?{' '}
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
