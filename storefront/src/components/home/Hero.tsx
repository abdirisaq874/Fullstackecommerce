import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Truck, ShieldCheck, RefreshCcw, Sparkles } from 'lucide-react';
import { Container } from '@/components/ui';

export function Hero() {
  return (
    <section className="bg-surface">
      <Container className="py-6 lg:py-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Big sale panel */}
          <Link
            href="/search?sortBy=price_asc"
            className="group relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[1.75rem] bg-brand-gradient p-8 text-white lg:col-span-2 lg:p-12"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
            <div className="relative">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">Mega sale · this week</span>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Up to 60% off<br />across every category
              </h1>
              <p className="mt-4 max-w-md text-white/85">
                Thousands of products, bilingual smart search, and lightning-fast checkout.
              </p>
            </div>
            <span className="relative mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink transition group-hover:gap-3">
              Shop deals <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Stacked offer tiles */}
          <div className="grid gap-4">
            <Link
              href="/c/electronics"
              className="group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[1.75rem] bg-muted p-6"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
              <div className="relative">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">New in tech</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">Gadgets &amp; audio</h3>
              </div>
              <span className="relative text-sm font-semibold text-ink transition group-hover:text-brand">Shop now →</span>
            </Link>
            <Link
              href="/c/health-and-beauty"
              className="group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[1.75rem] bg-brand-50 p-6"
            >
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-brand/15 blur-2xl" />
              <div className="relative">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">Beauty event</span>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">Up to 40% off</h3>
              </div>
              <span className="relative text-sm font-semibold text-ink transition group-hover:text-brand">Explore →</span>
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
    { icon: <Truck className="h-5 w-5" />, title: t('freeShipping'), text: t('freeShippingText') },
    { icon: <ShieldCheck className="h-5 w-5" />, title: t('secure'), text: t('secureText') },
    { icon: <RefreshCcw className="h-5 w-5" />, title: t('returns'), text: t('returnsText') },
    { icon: <Sparkles className="h-5 w-5" />, title: t('smart'), text: t('smartText') },
  ];
  return (
    <Container className="py-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-3 rounded-2xl bg-muted p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand">{it.icon}</div>
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">{it.title}</p>
              <p className="text-xs text-muted-fg">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
