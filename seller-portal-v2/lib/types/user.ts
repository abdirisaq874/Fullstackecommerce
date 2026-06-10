/**
 * User-domain types for seller-portal-v2.
 *
 * Mirrors the backend `UserRole` enum defined in
 * `ecommerce-backend/src/users/schemas/user.schema.ts`. Kept as a const-object
 * (with a matching string-literal `UserRole` type) so call-sites can use
 * `UserRole.SELLER` ergonomically while staying compatible with the
 * `'customer' | 'seller' | 'admin'` string-literal union already exported from
 * `lib/api/auth-api.ts` and `lib/store/auth-slice.ts`.
 *
 * If you add a role to the backend enum, mirror it here.
 */

export const UserRole = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
