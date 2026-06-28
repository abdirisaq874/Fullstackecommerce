import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Truck, ShieldCheck, RefreshCcw, Sparkles } from 'lucide-react';
import { Button, Container } from '@/components/ui';

export function Hero() {
  const t = useTranslations('home');
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-brand-gradient opacity-95" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <Container className="relative py-16 sm:py-24">
        <div className="max-w-2xl text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur">
            <Sparkles className="h-4 w-4" /> {t('heroBadge')}
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] sm:text-7xl">
            {t('heroTitlePre')} <span className="text-sale">{t('heroTitleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-white/90">{t('heroText')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/search">
              <Button variant="sale" size="lg" className="gap-2">
                {t('shopNow')} <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/search?sortBy=popular">
              <Button size="lg" className="border-2 border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                {t('bestsellers')}
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function ValueProps() {
  const t = useTranslations('value');
  const items = [
    { icon: <Truck className="h-6 w-6" />, title: t('freeShipping'), text: t('freeShippingText') },
    { icon: <ShieldCheck className="h-6 w-6" />, title: t('secure'), text: t('secureText') },
    { icon: <RefreshCcw className="h-6 w-6" />, title: t('returns'), text: t('returnsText') },
    { icon: <Sparkles className="h-6 w-6" />, title: t('smart'), text: t('smartText') },
  ];
  return (
    <Container className="py-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand">{it.icon}</div>
            <div>
              <p className="font-bold leading-tight">{it.title}</p>
              <p className="text-sm text-muted-fg">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
