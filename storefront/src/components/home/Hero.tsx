import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRight, Truck, ShieldCheck, RefreshCcw, Sparkles, Star } from 'lucide-react';
import { Button, Container } from '@/components/ui';

export function Hero() {
  const t = useTranslations('home');
  return (
    <section className="relative overflow-hidden bg-muted">
      {/* soft indigo ambient light */}
      <div className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        {/* Copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand">
            <Sparkles className="h-4 w-4" /> {t('heroBadge')}
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">
            {t('heroTitlePre')} <span className="text-brand">{t('heroTitleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-fg">{t('heroText')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/search">
              <Button size="lg" className="gap-2">{t('shopNow')} <ArrowRight className="h-5 w-5" /></Button>
            </Link>
            <Link href="/search?sortBy=popular">
              <Button variant="outline" size="lg">{t('bestsellers')}</Button>
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-muted-fg">
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-sale text-sale" /> <b className="text-ink">4.9</b> avg rating
            </span>
            <span><b className="text-ink">5,500+</b> categories</span>
            <span><b className="text-ink">EN · SO</b> bilingual</span>
          </div>
        </div>

        {/* Visual */}
        <div className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-brand-100 shadow-lift ring-1 ring-line">
            <Image
              src="https://picsum.photos/seed/suuq-hero/1000/820"
              alt=""
              fill
              priority
              sizes="(min-width:1024px) 42vw, 92vw"
              className="object-cover"
            />
          </div>
          {/* floating cards */}
          <div className="absolute -left-4 bottom-6 hidden rounded-2xl border border-line bg-surface/90 p-3.5 shadow-lift backdrop-blur sm:flex sm:items-center sm:gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><Truck className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold text-ink">Free shipping</p>
              <p className="text-xs text-muted-fg">On orders over $50</p>
            </div>
          </div>
          <div className="absolute -right-3 top-6 hidden rounded-2xl border border-line bg-surface/90 px-4 py-3 text-center shadow-lift backdrop-blur sm:block">
            <p className="flex items-center justify-center gap-1 text-xl font-extrabold text-ink">
              <Star className="h-4 w-4 fill-sale text-sale" /> 4.9
            </p>
            <p className="text-[11px] text-muted-fg">12k+ reviews</p>
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
