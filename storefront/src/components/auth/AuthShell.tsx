import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Sparkles, Truck, ShieldCheck, RefreshCcw } from 'lucide-react';
import { SITE_NAME } from '@/lib/utils';

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTranslations('auth');
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <Link href="/" className="relative font-display text-3xl font-extrabold">{SITE_NAME}</Link>
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur">
            <Sparkles className="h-4 w-4" /> {t('panelBadge')}
          </span>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-tight">{t('panelTitle')}</h2>
          <p className="mt-3 max-w-sm text-white/85">{t('panelText')}</p>
          <ul className="mt-8 space-y-3 text-sm font-semibold">
            <li className="flex items-center gap-3"><Truck className="h-5 w-5" /> {t('perkShipping')}</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /> {t('perkSecure')}</li>
            <li className="flex items-center gap-3"><RefreshCcw className="h-5 w-5" /> {t('perkReturns')}</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} {SITE_NAME}</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block font-display text-2xl font-extrabold text-gradient lg:hidden">{SITE_NAME}</Link>
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-fg">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-fg">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
