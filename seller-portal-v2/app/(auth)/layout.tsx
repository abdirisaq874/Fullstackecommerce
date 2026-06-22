import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Layout for unauthenticated routes (/login, /register, /forgot-password,
 * /reset-password).
 *
 * Visual design:
 *   - Forest-green background (brand-800 → brand-900 gradient) that mirrors
 *     the portal's primary action color.
 *   - Centered white card containing the form, with the Gaarsii brand mark
 *     pinned to the top.
 *   - A subtle footer with the marketing copy and copyright.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-800 to-brand-900 text-stone-900">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand mark */}
          <Link
            href="/"
            className="flex items-center justify-center gap-3 mb-8"
            aria-label="Gaarsii home"
          >
            <div className="w-11 h-11 rounded-md bg-white text-brand-800 grid place-items-center shadow-sm">
              <span className="font-serif text-2xl leading-none translate-y-[1px]">
                G
              </span>
            </div>
            <div className="text-white">
              <div className="font-serif text-2xl leading-none">Gaarsii</div>
              <div className="text-2xs mt-1 tracking-wide uppercase text-brand-100">
                Seller portal
              </div>
            </div>
          </Link>

          {/* Card */}
          <div className="bg-white border border-brand-100 rounded-xl shadow-xl px-7 py-8">
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-brand-100 mt-6">
            &copy; {new Date().getFullYear()} Gaarsii. Selling across the
            Turkey–East Africa corridor.
          </p>
        </div>
      </main>
    </div>
  );
}
