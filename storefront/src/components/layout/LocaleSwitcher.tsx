'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locales, localeNames, LOCALE_COOKIE, type Locale } from '@/i18n/config';

export function LocaleSwitcher() {
  const router = useRouter();
  const active = useLocale();
  const [open, setOpen] = useState(false);

  const change = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex h-10 items-center gap-1 rounded-lg px-2 hover:bg-muted"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="h-5 w-5" />
        <span className="hidden text-sm font-bold uppercase sm:inline">{active}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-40 animate-fade-up rounded-2xl border border-line bg-surface p-1 shadow-lift">
            {locales.map((l) => (
              <button
                key={l}
                onClick={() => change(l)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted',
                  l === active && 'text-brand',
                )}
              >
                {localeNames[l]}
                {l === active && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
