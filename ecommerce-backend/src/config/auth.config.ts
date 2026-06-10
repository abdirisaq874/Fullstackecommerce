import { registerAs } from '@nestjs/config';

/**
 * Validates and resolves the JWT secret. In production, the secret must be set,
 * must not be the insecure default, and must be at least 32 characters. In
 * non-production environments the default is permitted (with a warning) to
 * keep local development frictionless.
 */
export function resolveJwtSecret(
  jwtSecret: string | undefined,
  nodeEnv: string | undefined,
): string {
  const isProduction = nodeEnv === 'production';
  const isInsecure =
    !jwtSecret || jwtSecret === 'change-me-in-production' || jwtSecret.length < 32;

  if (isProduction && isInsecure) {
    throw new Error('JWT_SECRET must be set to a strong value (>= 32 chars) in production');
  }

  if (isInsecure) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth.config] JWT_SECRET is using an insecure value. This is only allowed outside production.',
    );
  }

  return jwtSecret ?? 'change-me-in-production';
}

export default registerAs('auth', () => {
  const jwtSecret = resolveJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV);

  return {
    jwtSecret,
    jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  };
});
