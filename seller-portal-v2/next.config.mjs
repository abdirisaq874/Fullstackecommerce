/** @type {import('next').NextConfig} */

// NOTE: The Sentry `org` and `project` values below are placeholders. They
// should be filled in once the Sentry project exists, either manually or
// by re-running `npx @sentry/wizard@latest -i nextjs`. Without them,
// source-map upload is skipped but the SDK still reports errors.
import { withSentryConfig } from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

// NEXT_PUBLIC_API_URL includes a path (…/api/v1), but CSP `connect-src` matches
// a source's path *exactly* unless it ends in `/`. Embedding the full path here
// would allow only `https://host/api/v1` and BLOCK every real endpoint below it
// (e.g. /api/v1/auth/login → "TypeError: Failed to fetch"). Allow the API
// *origin* (scheme + host) instead, which covers all paths under it.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
let apiConnectSrc = apiUrl;
try {
  if (apiUrl) apiConnectSrc = new URL(apiUrl).origin;
} catch {
  apiConnectSrc = apiUrl;
}

// Content Security Policy
// NOTE: Next.js requires 'unsafe-inline' for scripts during development (HMR, inline
// bootstrap scripts). In production we keep 'unsafe-inline' for now because Next.js
// also emits inline scripts at build-time without nonces unless you switch to the
// experimental nonce-based CSP. Revisit once we adopt Next.js strict CSP.
// Tailwind injects inline <style> tags, so 'unsafe-inline' is required for style-src.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${apiConnectSrc} https://*.ingest.sentry.io`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .replace(/\s+/g, ' ')
  .trim();

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: isProd ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    value: cspDirectives,
  },
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker/Cloud Run image.
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.r2.dev' }, // Cloudflare R2 product images
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(
  nextConfig,
  {
    // Suppress Sentry build-time logs (use `silent: false` to debug uploads).
    silent: true,
    // TODO: fill in once the Sentry project is created.
    org: 'TODO_FILL_IN',
    project: 'TODO_FILL_IN',
  },
  {
    // Upload a larger set of source maps for better stack traces.
    widenClientFileUpload: true,
    // Hide source maps from the public bundle.
    hideSourceMaps: true,
    // Tree-shake Sentry logger statements to reduce bundle size.
    disableLogger: true,
  },
);
