'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Check, Lock, MapPin, CreditCard, ShoppingBag } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { Button, Container, EmptyState } from '@/components/ui';
import { AddressForm } from '@/components/checkout/AddressForm';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useGetCartQuery } from '@/store/api/cartApi';
import { useListAddressesQuery, useAddAddressMutation } from '@/store/api/usersApi';
import { useCreateOrderMutation } from '@/store/api/ordersApi';
import { useCreatePaymentIntentMutation } from '@/store/api/paymentsApi';
import type { Address, Order } from '@/types';

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
  const [createOrder, { isLoading: creating }] = useCreateOrderMutation();
  const [createIntent] = useCreatePaymentIntentMutation();

  const [step, setStep] = useState<'address' | 'payment'>('address');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [shipping, setShipping] = useState<Address | null>(null);
  const [notes, setNotes] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const items = cart?.items ?? [];
  const chosen = shipping ?? addresses?.find((a) => a._id === selectedId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0];

  if (cartLoading) return <Container className="py-16"><div className="skeleton h-64" /></Container>;
  if (items.length === 0 && !order) {
    return (
      <Container className="py-16">
        <EmptyState icon={<ShoppingBag className="h-12 w-12" />} title={t('emptyCart')} description={t('emptyCartText')}
          action={<Link href="/search"><Button>{t('shopNow')}</Button></Link>} />
      </Container>
    );
  }

  const proceedToPayment = async () => {
    if (!chosen) { toast.error(t('addAddressFirst')); return; }
    try {
      const created = await createOrder({ shippingAddress: chosen, notes: notes || undefined }).unwrap();
      setOrder(created);
      const intent = await createIntent({ orderId: created._id }).unwrap();
      setClientSecret(intent.clientSecret);
      setStep('payment');
    } catch {
      toast.error(t('couldNotStart'));
    }
  };

  const summary = order ?? { subtotal: cart?.subtotal ?? 0, shippingCost: 0, taxAmount: 0, discountAmount: cart?.discountAmount ?? 0, total: (cart?.subtotal ?? 0) - (cart?.discountAmount ?? 0), currency: 'USD' };

  return (
    <Container className="py-10">
      <h1 className="mb-2 font-display text-3xl font-extrabold">{t('title')}</h1>
      <Steps step={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {step === 'address' ? (
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

              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-semibold">{t('orderNotes')}</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} className="focus-ring w-full rounded-xl border-2 border-line p-3 text-sm focus:border-brand" />
              </div>

              <Button size="lg" className="mt-6 w-full" loading={creating} disabled={!chosen} onClick={proceedToPayment}>
                {t('continueToPayment')}
              </Button>
            </section>
          ) : (
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><CreditCard className="h-5 w-5 text-brand" /> {t('payment')}</h2>
              {clientSecret && stripeConfigured ? (
                <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#7c3aed', borderRadius: '12px' } } }}>
                  <PaymentForm orderId={order!._id} />
                </Elements>
              ) : (
                <div className="rounded-xl bg-muted p-4 text-sm">
                  <p className="font-semibold">{t('notConfigured')}</p>
                  <p className="mt-1 text-muted-fg">{t('notConfiguredHint')} <strong>{order?.orderNumber}</strong></p>
                  <Link href={`/checkout/confirmation/${order?._id}`} className="mt-3 inline-block"><Button variant="outline">{t('viewOrder')}</Button></Link>
                </div>
              )}
              <button onClick={() => setStep('address')} className="mt-4 text-sm font-semibold text-muted-fg hover:text-brand">{t('backToAddress')}</button>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-4 font-bold">{t('orderSummary')}</h3>
            <ul className="space-y-3">
              {items.map((it) => (
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
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <Row label={t('subtotal')} value={formatPrice(summary.subtotal)} />
              {summary.discountAmount > 0 && <Row label={t('discount')} value={`−${formatPrice(summary.discountAmount)}`} />}
              <Row label={t('shipping')} value={summary.shippingCost ? formatPrice(summary.shippingCost) : t('free')} />
              <Row label={t('tax')} value={formatPrice(summary.taxAmount)} />
            </div>
            <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-extrabold">
              <span>{t('total')}</span>
              <span>{formatPrice(summary.total)}</span>
            </div>
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-muted-fg"><Lock className="h-3.5 w-3.5" /> {t('secureSsl')}</p>
        </aside>
      </div>
    </Container>
  );
}

function PaymentForm({ orderId }: { orderId: string }) {
  const t = useTranslations('checkout');
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) {
      toast.error(error.message || t('paymentFailed'));
      setPaying(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      toast.success(t('paymentSuccess'));
      router.push(`/checkout/confirmation/${orderId}`);
    } else {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-5">
      <PaymentElement />
      <Button size="lg" className="w-full gap-2" loading={paying} disabled={!stripe} onClick={pay}>
        <Lock className="h-4 w-4" /> {t('payNow')}
      </Button>
    </div>
  );
}

function Steps({ step }: { step: 'address' | 'payment' }) {
  const t = useTranslations('checkout');
  const steps = [{ key: 'address' as const }, { key: 'payment' as const }];
  return (
    <div className="flex items-center gap-3 text-sm font-bold">
      {steps.map((s, i) => {
        const active = s.key === step;
        const done = step === 'payment' && s.key === 'address';
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className={cn('grid h-7 w-7 place-items-center rounded-full', active ? 'bg-brand-gradient text-white' : done ? 'bg-success text-white' : 'bg-muted text-muted-fg')}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={active ? 'text-ink' : 'text-muted-fg'}>{s.key === 'address' ? t('stepAddress') : t('stepPayment')}</span>
            {i === 0 && <span className="h-px w-8 bg-line" />}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-fg">{label}</span><span className="font-semibold">{value}</span></div>;
}
