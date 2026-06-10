/**
 * Auth form schemas — shared between the login/register pages (B3) and the
 * forgot-password / reset-password flow (B4).
 *
 * The schemas describe the *form input* shape (what react-hook-form binds to);
 * the backend DTOs in `lib/api/auth-api.ts` describe the *request* shape. The
 * two overlap heavily but are not identical (forms include `confirmPassword`
 * and `agreeToTerms`, which are stripped before sending).
 */
import { z } from 'zod';

// --- shared building blocks -------------------------------------------------

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

/**
 * Password rule for *new* passwords (register / reset):
 *   - min 8 characters
 *   - at least one lowercase letter
 *   - at least one uppercase letter
 *   - at least one digit
 *
 * The login schema intentionally uses a looser rule (min 1) so a user with a
 * legacy short password can still sign in to update it.
 */
const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit');

// --- login ------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// --- register ---------------------------------------------------------------

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    agreeToTerms: z.literal(true, {
      // zod v4: literal validators surface via the error message below.
      message: 'You must agree to the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

// --- forgot / reset password (B4) ------------------------------------------

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
