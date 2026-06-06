import { registerAs } from '@nestjs/config';

const INSECURE_DEFAULT = 'change-me-in-production';
const MIN_SECRET_LENGTH = 32;

/**
 * Validate the JWT secret at boot. In production we refuse to start with a
 * missing/default/weak secret (signing tokens with a known value lets anyone
 * forge them). In non-production we warn so local dev still works.
 */
export function resolveJwtSecret(
  secret = process.env.JWT_SECRET,
  env = process.env.NODE_ENV,
): string {
  const isProd = env === 'production';
  const missingOrDefault = !secret || secret === INSECURE_DEFAULT;

  if (isProd && (missingOrDefault || secret!.length < MIN_SECRET_LENGTH)) {
    throw new Error(
      `JWT_SECRET must be set to a strong, unique value (>= ${MIN_SECRET_LENGTH} chars) in production — refusing to boot.`,
    );
  }
  if (missingOrDefault) {
    // eslint-disable-next-line no-console
    console.warn('[auth] WARNING: JWT_SECRET is unset or using the insecure default — set a strong JWT_SECRET before deploying.');
  }
  return secret || INSECURE_DEFAULT;
}

export default registerAs('auth', () => ({
  jwtSecret: resolveJwtSecret(),
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
