'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useRegisterMutation, useLazyGetMeQuery } from '@/lib/api/auth-api';
import { useAppDispatch } from '@/lib/api/store';
import { setCredentials } from '@/lib/store/auth-slice';
import { registerSchema, type RegisterFormValues } from '@/lib/schemas/auth';
import { Field, Input } from '@/components/primitives/field';
import { Button } from '@/components/primitives/button';
import { Alert } from '@/components/primitives/alert';

/**
 * Seller registration page.
 *
 * Submits to `POST /auth/register` with `role: 'seller'`. The form collects
 * `confirmPassword` and `agreeToTerms` for UX but those fields never leave
 * the browser. On success we hydrate the auth slice (same path as login)
 * and route to `/dashboard`.
 */
export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [registerSeller, { isLoading: isRegistering, error }] =
    useRegisterMutation();
  const [fetchMe, { isFetching: isFetchingMe }] = useLazyGetMeQuery();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false as unknown as true,
    },
  });

  const isSubmitting = isRegistering || isFetchingMe;

  async function onSubmit(values: RegisterFormValues) {
    const tokens = await registerSeller({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      password: values.password,
      role: 'seller',
    }).unwrap();

    // Persist tokens to localStorage BEFORE any follow-up authenticated request
    // (fetchMe). base-api.ts's prepareHeaders reads from localStorage, so the
    // tokens must already be there or `/users/me` runs unauthenticated and 401s.
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

    router.push('/dashboard');
  }

  const submitError = extractErrorMessage(error);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-medium text-stone-900">
          Create a seller account
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          List products, fulfill orders and grow your store on Gaarsii.
        </p>
      </header>

      {submitError && (
        <Alert variant="danger" className="mb-4">
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input
              autoComplete="given-name"
              placeholder="Aysel"
              aria-invalid={Boolean(errors.firstName)}
              {...register('firstName')}
            />
          </Field>

          <Field label="Last name" required error={errors.lastName?.message}>
            <Input
              autoComplete="family-name"
              placeholder="Yılmaz"
              aria-invalid={Boolean(errors.lastName)}
              {...register('lastName')}
            />
          </Field>
        </div>

        <Field label="Email" required error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          required
          hint="At least 8 characters with upper case, lower case and a digit."
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
          label="Confirm password"
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

        <div>
          <label className="flex items-start gap-2.5 text-sm text-stone-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus:ring-brand-600"
              aria-invalid={Boolean(errors.agreeToTerms)}
              {...register('agreeToTerms')}
            />
            <span>
              I agree to the{' '}
              <Link
                href="/terms"
                className="font-medium text-brand-700 hover:text-brand-800"
              >
                terms of service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="font-medium text-brand-700 hover:text-brand-800"
              >
                privacy policy
              </Link>
              .
            </span>
          </label>
          {errors.agreeToTerms?.message && (
            <div className="text-xs text-red-600 mt-1">
              {errors.agreeToTerms.message}
            </div>
          )}
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-stone-600 mt-6">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Sign in
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
