'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Check, Lock, MapPin, CreditCard, ShoppingBag, Banknote, Smartphone, Wallet,
  Store, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { Button, Container, EmptyState } from '@/components/ui';
import { AddressForm } from '@/components/checkout/AddressForm';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useGetCartQuery } from '@/store/api/cartApi';
import { useListAddressesQuery, useAddAddressMutation } from '@/store/api/usersApi';
import { useCreateOrderMutation } from '@/store/api/ordersApi';
import * as metaPixel from '@/lib/meta-pixel';
import type { Address, CartItem, PaymentMethod } from '@/types';

type Step = 'address' | 'review' | 'payment' | 'place';
const STEP_ORDER: Step[] = ['address', 'review', 'payment', 'place'];

// Saved addresses carry DB metadata (_id, isDefault, userId, …). The order API
// validates with forbidNonWhitelisted, so send ONLY the address fields it
// accepts — otherwise placement fails with a 400.
function toShippingAddress(a: Address): Address {
  return {
    fullName: a.fullName,
    line1: a.line1,
    ...(a.line2 ? { line2: a.line2 } : {}),
    city: a.city,
    ...(a.state ? { state: a.state } : {}),
    postalCode: a.postalCode,
    countryCode: a.countryCode,
    ...(a.phone ? { phone: a.phone } : {}),
  };
}

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  return (
    <RequireAuth message={t('signInToBuy')}>
      <CheckoutView />
    </RequireAuth>
  );
}

function CheckoutView() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const { data: cart, isLoading: cartLoading } = useGetCartQuery();
  const { data: addresses } = useListAddressesQuery();
  const [addAddress] = useAddAddressMutation();
  const [createOrder, { isLoading: placing }] = useCreateOrderMutation();

  const [step, setStep] = useState<Step>('address');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [shipping, setShipping] = useState<Address | null>(null);
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cod');

  const items = (cart?.items ?? []) as CartItem[];
  const chosen = shipping ?? addresses?.find((a) => a._id === selectedId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0];

  // Group cart lines by store so checkout, like the order, is organised per seller.
  const groups = useMemo(() => {
    const m = new Map<string, { storeName: string; items: CartItem[]; subtotal: number }>();
    for (const it of items) {
      const key = it.sellerId || it.storeName || 'store';
      const g = m.get(key) ?? { storeName: it.storeName || 'Store', items: [], subtotal: 0 };
      g.items.push(it);
      g.subtotal += it.unitPrice * it.quantity;
      m.set(key, g);
    }
    return [...m.values()];
  }, [items]);

  const subtotal = cart?.subtotal ?? 0;
  const discount = cart?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  // Meta Pixel InitiateCheckout — fire once when the cart first loads. content
  // ids are product slugs (matching the catalog feed); items missing a slug are
  // dropped from content_ids but still counted in value/num_items.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return;
    checkoutTracked.current = true;
    metaPixel.initiateCheckout({
      ids: items.map((i) => i.slug).filter(Boolean) as string[],
      value: total,
      numItems: items.reduce((sum, i) => sum + i.quantity, 0),
    });
  }, [items, total]);

  const PAYMENT_METHODS: { id: PaymentMethod; icon: LucideIcon; available: boolean }[] = [
    { id: 'cod', icon: Banknote, available: true },
    { id: 'card', icon: CreditCard, available: false },
    { id: 'mpesa', icon: Smartphone, available: false },
    { id: 'waafi', icon: Wallet, available: false },
  ];

  if (cartLoading) return <Container className="py-16"><div className="skeleton h-64" /></Container>;
  if (items.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState icon={<ShoppingBag className="h-12 w-12" />} title={t('emptyCart')} description={t('emptyCartText')}
          action={<Link href="/search"><Button>{t('shopNow')}</Button></Link>} />
      </Container>
    );
  }

  const goReview = () => {
    if (!chosen) { toast.error(t('addAddressFirst')); return; }
    setStep('review');
  };

  const placeOrder = async () => {
    if (!chosen) { toast.error(t('addAddressFirst')); setStep('address'); return; }
    if (payment !== 'cod') { toast.error(t('couldNotPlace')); return; }
    try {
      // A multi-store cart places one order per store → an array of orders.
      const created = await createOrder({ shippingAddress: toShippingAddress(chosen), notes: notes || undefined, paymentMethod: payment }).unwrap();
      const orders = Array.isArray(created) ? created : [created];
      if (!orders.length) { toast.error(t('couldNotPlace')); return; }
      // Land on the first order's confirmation; the rest are in the buyer's order history.
      const first = orders[0]._id;
      router.push(`/checkout/confirmation/${first}${orders.length > 1 ? `?more=${orders.length - 1}` : ''}`);
    } catch {
      toast.error(t('couldNotPlace'));
    }
  };

  const paymentLabel = (id: PaymentMethod) => t(id);

  return (
    <Container className="py-10">
      <h1 className="mb-2 font-display text-3xl font-extrabold">{t('title')}</h1>
      <Steps step={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {/* ── Step 1: Address ── */}
          {step === 'address' && (
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><MapPin className="h-5 w-5 text-brand" /> {t('shippingAddress')}</h2>

              {(addresses?.length ?? 0) > 0 && !adding && (
                <div className="space-y-3">
                  {addresses!.map((a) => (
                    <label key={a._id} className={cn('flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition', (chosen?._id === a._id) ? 'border-brand bg-brand-50' : 'border-line hover:border-ink/20')}>
                      <input type="radio" name="addr" checked={chosen?._id === a._id} onChange={() => { setSelectedId(a._id); setShipping(null); }} className="mt-1 h-4 w-4 accent-[hsl(var(--brand))]" />
                      <div className="text-sm">
                        <p className="font-bold">{a.fullName} {a.isDefault && <span className="ml-1 text-xs font-semibold text-brand">· {t('default')}</span>}</p>
                        <p className="text-muted-fg">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.postalCode}, {a.countryCode}</p>
                        {a.phone && <p className="text-muted-fg">{a.phone}</p>}
                      </div>
                    </label>
                  ))}
                  <button onClick={() => setAdding(true)} className="text-sm font-bold text-brand hover:underline">{t('useNewAddress')}</button>
                </div>
              )}

              {(adding || (addresses?.length ?? 0) === 0) && (
                <AddressForm
                  submitLabel={t('useThisAddress')}
                  showSaveToggle
                  onSubmit={async (addr, save) => {
                    setShipping(addr);
                    setSelectedId(undefined);
                    setAdding(false);
                    if (save) { try { await addAddress(addr).unwrap(); } catch { /* non-blocking */ } }
                    toast.success(t('addressSet'));
                  }}
                />
              )}

              <Button size="lg" className="mt-6 w-full" disabled={!chosen} onClick={goReview}>
                {t('continueToReview')}
              </Button>
            </section>
          )}

          {/* ── Step 2: Review items (grouped by store) ── */}
          {step === 'review' && (
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><ShoppingBag className="h-5 w-5 text-brand" /> {t('reviewTitle')}</h2>
              <div className="space-y-5">
                {groups.map((g, gi) => (
                  <StoreGroup key={gi} storeName={g.storeName} subtotalLabel={t('subtotal')} subtotal={g.subtotal} soldByLabel={t('soldBy')}>
                    {g.items.map((it) => (
                      <LineItem key={it.variantSku} item={it} />
                    ))}
                  </StoreGroup>
                ))}
              </div>

              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-semibold">{t('orderNotes')}</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} className="focus-ring w-full rounded-xl border-2 border-line p-3 text-sm focus:border-brand" />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('address')} className="text-sm font-semibold text-muted-fg hover:text-brand">{t('backToAddress')}</button>
                <Button size="lg" onClick={() => setStep('payment')}>{t('continueToPayment')}</Button>
              </div>
            </section>
          )}

          {/* ── Step 3: Payment method ── */}
          {step === 'payment' && (
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold"><CreditCard className="h-5 w-5 text-brand" /> {t('paymentMethodTitle')}</h2>
              <p className="mb-4 text-sm text-muted-fg">{t('selectPayment')}</p>
              <div className="space-y-3">
                {PAYMENT_METHODS.map(({ id, icon: Icon, available }) => {
                  const active = payment === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!available}
                      onClick={() => available && setPayment(id)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition',
                        !available && 'cursor-not-allowed opacity-55',
                        active ? 'border-brand bg-brand-50' : 'border-line hover:border-ink/20',
                      )}
                    >
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', active ? 'bg-brand text-white' : 'bg-muted text-ink')}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center gap-2 font-bold">
                          {paymentLabel(id)}
                          {!available && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-fg">{t('comingSoon')}</span>}
                        </span>
                        <span className="block text-sm text-muted-fg">{t(`${id}Desc`)}</span>
                      </span>
                      {active && <Check className="h-5 w-5 text-brand" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('review')} className="text-sm font-semibold text-muted-fg hover:text-brand">{t('backToReview')}</button>
                <Button size="lg" disabled={!payment} onClick={() => setStep('place')}>{t('continueToPlace')}</Button>
              </div>
            </section>
          )}

          {/* ── Step 4: Place order (final review) ── */}
          {step === 'place' && (
            <section className="space-y-5">
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand" /> {t('deliverTo')}</h3>
                  <button onClick={() => setStep('address')} className="text-sm font-semibold text-brand hover:underline">{t('change')}</button>
                </div>
                {chosen && (
                  <div className="mt-2 text-sm text-muted-fg">
                    <p className="font-semibold text-ink">{chosen.fullName}</p>
                    <p>{chosen.line1}{chosen.line2 ? `, ${chosen.line2}` : ''}, {chosen.city} {chosen.postalCode}, {chosen.countryCode}</p>
                    {chosen.phone && <p>{chosen.phone}</p>}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4 text-brand" /> {t('paymentMethodTitle')}</h3>
                  <button onClick={() => setStep('payment')} className="text-sm font-semibold text-brand hover:underline">{t('change')}</button>
                </div>
                <p className="mt-2 text-sm"><span className="font-semibold">{paymentLabel(payment)}</span> <span className="text-muted-fg">· {t('payOnDelivery')}</span></p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <h3 className="mb-4 flex items-center gap-2 font-bold"><ShoppingBag className="h-4 w-4 text-brand" /> {t('items')}</h3>
                <div className="space-y-5">
                  {groups.map((g, gi) => (
                    <StoreGroup key={gi} storeName={g.storeName} subtotalLabel={t('subtotal')} subtotal={g.subtotal} soldByLabel={t('soldBy')}>
                      {g.items.map((it) => <LineItem key={it.variantSku} item={it} />)}
                    </StoreGroup>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setStep('payment')} className="text-sm font-semibold text-muted-fg hover:text-brand">{t('backToPayment')}</button>
                <Button size="lg" className="gap-2" loading={placing} onClick={placeOrder}>
                  <Check className="h-4 w-4" /> {t('placeOrder')}
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Summary (grouped by store) */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-4 font-bold">{t('orderSummary')}</h3>
            <div className="space-y-4">
              {groups.map((g, gi) => (
                <div key={gi}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-fg">
                    <Store className="h-3.5 w-3.5" /> {g.storeName}
                  </p>
                  <ul className="space-y-3">
                    {g.items.map((it) => (
                      <li key={it.variantSku} className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {it.imageUrl && <Image src={it.imageUrl} alt={it.productName} fill className="object-cover" sizes="56px" />}
                          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{it.quantity}</span>
                        </div>
                        <div className="flex flex-1 justify-between gap-2 text-sm">
                          <span className="line-clamp-2">{it.productName}</span>
                          <span className="font-semibold">{formatPrice(it.unitPrice * it.quantity)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <Row label={t('subtotal')} value={formatPrice(subtotal)} />
              {discount > 0 && <Row label={t('discount')} value={`−${formatPrice(discount)}`} />}
              <Row label={t('shipping')} value={t('free')} />
              <Row label={t('tax')} value={formatPrice(0)} />
            </div>
            <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-extrabold">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-muted-fg"><Lock className="h-3.5 w-3.5" /> {t('secureSsl')}</p>
        </aside>
      </div>
    </Container>
  );
}

function StoreGroup({ storeName, soldByLabel, subtotalLabel, subtotal, children }: { storeName: string; soldByLabel: string; subtotalLabel: string; subtotal: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-muted/50 px-4 py-2.5">
        <Store className="h-4 w-4 text-brand" />
        <span className="text-sm font-bold">{storeName}</span>
        <span className="ml-auto text-xs text-muted-fg">{subtotalLabel}: <span className="font-semibold text-ink">{formatPrice(subtotal)}</span></span>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function LineItem({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.imageUrl && <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="64px" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold">{item.productName}</p>
        {item.variantName && <p className="text-xs text-muted-fg">{item.variantName}</p>}
        <p className="text-xs text-muted-fg">× {item.quantity}</p>
      </div>
      <span className="shrink-0 text-sm font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const t = useTranslations('checkout');
  const labels: Record<Step, string> = {
    address: t('stepAddress'), review: t('stepReview'), payment: t('stepPayment'), place: t('stepPlace'),
  };
  const currentIdx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-bold sm:gap-3">
      {STEP_ORDER.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-2 sm:gap-3">
            <span className={cn('grid h-7 w-7 place-items-center rounded-full', active ? 'bg-brand-gradient text-white' : done ? 'bg-success text-white' : 'bg-muted text-muted-fg')}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={active ? 'text-ink' : 'text-muted-fg'}>{labels[s]}</span>
            {i < STEP_ORDER.length - 1 && <ChevronRight className="h-4 w-4 text-line" />}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-fg">{label}</span><span className="font-semibold">{value}</span></div>;
}
