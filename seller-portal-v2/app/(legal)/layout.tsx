import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Layout for the public legal pages (/terms, /privacy).
 *
 * These sit outside the (auth) and (portal) groups so they're reachable
 * without a session (a visitor on the signup screen must be able to read them).
 * `middleware.ts` allow-lists `terms` and `privacy` so navigation isn't
 * redirected to /login.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Gaarsii home"
          >
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-800 text-white shadow-sm">
              <span className="font-serif text-lg leading-none">G</span>
            </div>
            <div>
              <div className="font-serif text-lg leading-none text-stone-900">
                Gaarsii
              </div>
              <div className="text-2xs uppercase tracking-wide text-stone-400">
                Seller portal
              </div>
            </div>
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Back to sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <article className="rounded-xl border border-stone-200 bg-white px-7 py-9 shadow-sm">
          {children}
        </article>
        <footer className="mt-6 flex items-center justify-between px-1 pb-4 text-xs text-stone-400">
          <span>© {new Date().getFullYear()} Gaarsii. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-stone-600">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-stone-600">
              Privacy Policy
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}