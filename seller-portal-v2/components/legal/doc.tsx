import type { ReactNode } from 'react';

/**
 * Presentational primitives for legal documents (Terms, Privacy).
 * Server components — plain styled markup, no state. Keeps the /terms and
 * /privacy pages readable and visually consistent.
 */

export function DocHeader({ title, updated }: { title: string; updated: string }) {
  return (
    <header className="mb-8 border-b border-stone-200 pb-6">
      <h1 className="font-serif text-3xl text-stone-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated: {updated}</p>
    </header>
  );
}

/**
 * Amber callout flagging that the copy is a starting template, not legal
 * advice. Remove or replace once your own counsel has reviewed the document.
 */
export function TemplateNotice() {
  return (
    <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
      <strong className="font-semibold">Template notice.</strong> This document is a general
      starting template, not legal advice. Before relying on it, have it reviewed by a
      qualified attorney and replace the bracketed placeholders (legal entity, address,
      jurisdiction, contact details) to match your business and local laws.
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-xl font-semibold text-stone-900">{children}</h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-base font-semibold text-stone-800">{children}</h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm leading-7 text-stone-700">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 text-sm leading-7 text-stone-700">
      {children}
    </ul>
  );
}