'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, Heart, ShoppingBag, Tag, Truck, ArrowRight, X } from 'lucide-react';
import { formatPrice, formatCents } from '@/lib/utils';
import { Button, Container, EmptyState, Input, QtyStepper, Badge } from '@/components/ui';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAppDispatch } from '@/store';
import { toggleWishlist } from '@/store/slices/wishlistSlice';
import {
  useGetCartQuery, useUpdateCartItemMutation, useRemoveCartItemMutation, useClearCartMutation,
} from '@/store/api/cartApi';
import { useApplyCouponMutation, useRemoveCouponMutation } from '@/store/api/couponsApi';
import { useShippingQuoteMutation } from '@/store/api/shippingApi';

export default function CartPage() {
  const t = useTranslations('cart');
  return (
    <RequireAuth message={t('savedToAccount')}>
      <CartView />
    </RequireAuth>
  );
}

function CartView() {
  const t = useTranslations('cart');
  const dispatch = useAppDispatch();
  const { data: cart, isLoading } = useGetCartQuery();
  const [updateItem] = useUpdateCartItemMutation();
  const [removeItem] = useRemoveCartItemMutation();
  const [clearCart] = useClearCartMutation();
  const [applyCoupon, { isLoading: applying }] = useApplyCouponMutation();
  const [removeCoupon] = useRemoveCouponMutation();
  const [getQuote, { data: quote, isLoading: quoting }] = useShippingQuoteMutation();

  const [code, setCode] = useState('');
  const [country, setCountry] = useState('US');

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const discount = cart?.discountAmount ?? 0;
  const cheapest = quote?.rates?.length ? [...quote.rates].sort((a, b) => a.costCents - b.costCents)[0] : undefined;
  const shipping = cheapest ? cheapest.costCents / 100 : 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  const handleApply = async () => {
    if (!code.trim()) return;
    try {
      await applyCoupon({ code: code.trim().toUpperCase() }).unwrap();
      toast.success(t('couponApplied'));
      setCode('');
    } catch {
      toast.error(t('couponInvalid'));
    }
  };

  const estimate = async () => {
    try {
      await getQuote({
        destinationCountry: country.toUpperCase(),
        items: items.map((i) => ({ sku: i.variantSku, qty: i.quantity })),
      }).unwrap();
    } catch {
      toast.error(t('couldNotEstimate'));
    }
  };

  if (isLoading) {
    return (
      <Container className="py-10">
        <div className="skeleton mb-6 h-9 w-40" />
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28" />)}</div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState
          icon={<ShoppingBag className="h-12 w-12" />}
          title={t('empty')}
          description={t('emptyText')}
          action={<Link href="/search"><Button size="lg">{t('startShopping')}</Button></Link>}
        />
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">{t('title')} ({cart?.itemCount})</h1>
        <button onClick={() => clearCart()} className="text-sm font-semibold text-muted-fg hover:text-danger">{t('clear')}</button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.variantSku} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <Link href={it.slug ? `/product/${it.slug}` : '#'} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                {it.imageUrl && <Image src={it.imageUrl} alt={it.productName} fill className="object-cover" sizes="96px" />}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold leading-snug">{it.productName}</p>
                    {it.variantName && <p className="text-sm text-muted-fg">{it.variantName}</p>}
                    <p className="mt-1 text-sm text-muted-fg">{formatPrice(it.unitPrice)} {t('each')}</p>
                  </div>
                  <button onClick={() => removeItem(it.variantSku)} aria-label={t('removeItem')} className="text-muted-fg hover:text-danger">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center gap-3">
                    <QtyStepper value={it.quantity} onChange={(q) => updateItem({ sku: it.variantSku, quantity: q })} />
                    <button
                      onClick={() => {
                        dispatch(toggleWishlist({ productId: it.productId, slug: it.slug ?? '', name: it.productName, price: it.unitPrice, currency: 'USD', imageUrl: it.imageUrl }));
                        removeItem(it.variantSku);
                        toast.success(t('movedToWishlist'));
                      }}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-muted-fg hover:text-accent"
                    >
                      <Heart className="h-4 w-4" /> {t('save')}
                    </button>
                  </div>
                  <span className="font-display text-lg font-extrabold">{formatPrice(it.unitPrice * it.quantity)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <aside className="space-y-4">
          {/* Coupon */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="mb-3 flex items-center gap-2 font-bold"><Tag className="h-4 w-4 text-accent" /> {t('promo')}</p>
            {cart?.couponCode ? (
              <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2">
                <span className="font-bold text-success">{cart.couponCode}</span>
                <button onClick={() => removeCoupon()} aria-label={t('removeCoupon')} className="text-success hover:text-danger"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder={t('enterCode')} value={code} onChange={(e) => setCode(e.target.value)} className="h-11" />
                <Button variant="outline" loading={applying} onClick={handleApply}>{t('apply')}</Button>
              </div>
            )}
          </div>

          {/* Shipping estimate */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="mb-3 flex items-center gap-2 font-bold"><Truck className="h-4 w-4 text-brand" /> {t('estimateShipping')}</p>
            <div className="flex gap-2">
              <Input placeholder={t('countryPlaceholder')} value={country} onChange={(e) => setCountry(e.target.value)} className="h-11 uppercase" maxLength={2} />
              <Button variant="outline" loading={quoting} onClick={estimate}>{t('getRates')}</Button>
            </div>
            {quote?.rates?.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {quote.rates.map((r) => (
                  <li key={r.method} className="flex justify-between">
                    <span className="capitalize">{r.method} <span className="text-muted-fg">({r.minDays}-{r.maxDays}d)</span></span>
                    <span className="font-semibold">{formatCents(r.costCents)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Totals */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="space-y-2 text-sm">
              <Row label={t('subtotal')} value={formatPrice(subtotal)} />
              {discount > 0 && <Row label={t('discount')} value={`−${formatPrice(discount)}`} accent />}
              <Row label={t('shipping')} value={cheapest ? formatCents(cheapest.costCents) : t('calcAtCheckout')} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-lg font-extrabold">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link href="/checkout" className="mt-4 block">
              <Button size="lg" className="w-full gap-2">{t('checkout')} <ArrowRight className="h-5 w-5" /></Button>
            </Link>
            <Link href="/search" className="mt-2 block text-center text-sm font-semibold text-muted-fg hover:text-brand">{t('continueShopping')}</Link>
            <p className="mt-3 text-center text-xs text-muted-fg">{t('secureNote')}</p>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-fg">{label}</span>
      <span className={accent ? 'font-semibold text-success' : 'font-semibold'}>{value}</span>
    </div>
  );
}
