import { resolveJwtSecret } from './auth.config';

const STRONG = 'a'.repeat(40);

describe('resolveJwtSecret (C8 — JWT secret boot validation)', () => {
  it('throws in production when the secret is the insecure default', () => {
    expect(() => resolveJwtSecret('change-me-in-production', 'production')).toThrow();
  });

  it('throws in production when the secret is missing', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow();
  });

  it('throws in production when the secret is too short', () => {
    expect(() => resolveJwtSecret('short-secret', 'production')).toThrow();
  });

  it('accepts a strong secret in production', () => {
    expect(resolveJwtSecret(STRONG, 'production')).toBe(STRONG);
  });

  it('allows the default in development (warns, does not throw)', () => {
    expect(resolveJwtSecret('change-me-in-production', 'development')).toBe('change-me-in-production');
  });
});
