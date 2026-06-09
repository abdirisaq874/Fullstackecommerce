import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'change-me-in-production' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong value (>= 32 chars)');
  }

  return {
    jwtSecret,
    jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  };
});
