'use client';

/**
 * First-login onboarding wizard (H10).
 *
 * Reachable at /onboarding. A four-step wizard that helps a new seller fill
 * in the bare minimum store config so the rest of the portal makes sense:
 *
 *   1. Welcome / profile  → storeProfile (displayName, country, currency)
 *   2. Payouts            → payoutMethod (+ Stripe Connect CTA placeholder)
 *   3. Shipping           → optional default shipping zone + base rate
 *   4. Done               → CTA to /products/new
 *
 * No layout-level redirect — the dashboard renders a "complete your profile"
 * welcome card linking here when `storeProfile.displayName` is empty (see
 * components/dashboard/onboarding-welcome-card.tsx). That keeps the wizard
 * skippable and avoids race-conditions against the auth/settings queries.
 *
 * Each step owns its own RHF form (so back/forth retains partial state) and
 * submits via the existing API slices:
 *   - useUpdateSettingsMutation (seller-settings-api)
 *   - useCreateZoneMutation, useCreateRateMutation (shipping-api)
 *
 * Validation uses the schemas in lib/schemas/seller-settings.ts and shipping.ts.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ExternalLink, PartyPopper, Truck } from 'lucide-react';

import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Field, Input, Select } from '@/components/primitives/field';
import { useUpdateSettingsMutation } from '@/lib/api/seller-settings-api';
import { useCreateZoneMutation, useCreateRateMutation } from '@/lib/api/shipping-api';
import {
  storeProfileSchema,
  payoutsSchema,
  type StoreProfileFormValues,
  type PayoutsFormValues,
} from '@/lib/schemas/seller-settings';
import {
  zoneSchema,
  rateSchema,
  type ZoneFormInput,
  type ZoneFormValues,
  type RateFormInput,
  type RateFormValues,
} from '@/lib/schemas/shipping';

// ─── shared constants ───────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { code: '', name: '— Select —' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'KE', name: 'Kenya' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'AE', name: 'United Arab Emirates' },
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'TRY', 'KES', 'AED', 'ETB'];

const PAYOUT_METHODS: Array<{
  value: NonNullable<PayoutsFormValues['payoutMethod']>;
  label: string;
  description: string;
}> = [
  { value: 'stripe', label: 'Stripe', description: 'Connected Stripe account (recommended)' },
  { value: 'bank',   label: 'Bank',   description: 'Direct deposit to your bank' },
  { value: 'paypal', label: 'PayPal', description: 'Payouts via PayPal email' },
];

const TOTAL_STEPS = 4;

interface WizardState {
  profile?: StoreProfileFormValues;
  payouts?: PayoutsFormValues;
  // We do not need to retain shipping values past step 3 — they are
  // submitted in-place to the shipping API and only summarised at step 4.
  shipping?: { zoneName?: string; method?: string };
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({});

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="font-serif text-3xl text-stone-900 leading-tight">
          Welcome to your store
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          A few quick questions and you&apos;ll be ready to start selling.
        </p>
      </div>

      <StepProgress current={step} total={TOTAL_STEPS} />

      <Card className="p-6 mt-5">
        {step === 1 && (
          <Step1Profile
            defaultValues={state.profile}
            onSubmit={(values) => {
              setState((s) => ({ ...s, profile: values }));
              goNext();
            }}
          />
        )}
        {step === 2 && (
          <Step2Payouts
            defaultValues={state.payouts}
            onBack={goBack}
            onSubmit={(values) => {
              setState((s) => ({ ...s, payouts: values }));
              goNext();
            }}
          />
        )}
        {step === 3 && (
          <Step3Shipping
            onBack={goBack}
            onSkip={() => goNext()}
            onSubmitted={(summary) => {
              setState((s) => ({ ...s, shipping: summary }));
              goNext();
            }}
          />
        )}
        {step === 4 && (
          <Step4Done
            state={state}
            onBack={goBack}
            onFinish={() => router.push('/dashboard')}
          />
        )}
      </Card>

      <div className="mt-4 text-center text-xs text-stone-500">
        You can change any of this later under{' '}
        <Link href="/settings" className="text-brand-700 hover:underline">
          Settings
        </Link>
        .
      </div>
    </div>
  );
}

// ─── progress bar ───────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  const labels = ['Profile', 'Payouts', 'Shipping', 'Finish'];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-stone-500">
          Step {current} of {total}
        </div>
        <div className="text-xs text-stone-500">{labels[current - 1]}</div>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1;
          const state =
            idx < current ? 'done' : idx === current ? 'current' : 'todo';
          return (
            <div
              key={i}
              className={
                state === 'done'
                  ? 'h-1.5 flex-1 rounded-full bg-brand-600'
                  : state === 'current'
                  ? 'h-1.5 flex-1 rounded-full bg-brand-400'
                  : 'h-1.5 flex-1 rounded-full bg-stone-200'
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: profile ────────────────────────────────────────────────────────

function Step1Profile({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: StoreProfileFormValues;
  onSubmit: (values: StoreProfileFormValues) => void;
}) {
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StoreProfileFormValues>({
    resolver: zodResolver(storeProfileSchema) as never,
    defaultValues: {
      displayName: defaultValues?.displayName ?? '',
      slug: defaultValues?.slug ?? '',
      logoUrl: defaultValues?.logoUrl ?? '',
      country: defaultValues?.country ?? '',
      currency: defaultValues?.currency ?? 'USD',
      supportEmail: defaultValues?.supportEmail ?? '',
      supportPhone: defaultValues?.supportPhone ?? '',
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!values.displayName?.trim()) {
      toast.error('Please enter a store name to continue');
      return;
    }
    try {
      await updateSettings({
        storeProfile: {
          displayName: values.displayName.trim(),
          country: values.country || undefined,
          currency: values.currency,
        },
      }).unwrap();
      toast.success('Store profile saved');
      onSubmit(values);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save store profile';
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="font-serif text-xl text-stone-900">Tell us about your store</h2>
        <p className="text-sm text-stone-500 mt-1">
          The name and currency we&apos;ll show on your storefront and invoices.
        </p>
      </div>

      <Field
        label="Store name"
        required
        hint="Shown to customers as your storefront name."
        error={errors.displayName?.message}
      >
        <Input placeholder="My Store" {...register('displayName')} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Country" error={errors.country?.message}>
          <Select {...register('country')}>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default currency" required error={errors.currency?.message}>
          <Select {...register('currency')}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Next'}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Button>
      </div>
    </form>
  );
}

// ─── Step 2: payouts ────────────────────────────────────────────────────────

function Step2Payouts({
  defaultValues,
  onBack,
  onSubmit,
}: {
  defaultValues?: PayoutsFormValues;
  onBack: () => void;
  onSubmit: (values: PayoutsFormValues) => void;
}) {
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PayoutsFormValues>({
    resolver: zodResolver(payoutsSchema) as never,
    defaultValues: {
      stripeConnectAccountId: defaultValues?.stripeConnectAccountId ?? '',
      payoutMethod: defaultValues?.payoutMethod,
      bankAccountLast4: defaultValues?.bankAccountLast4 ?? '',
      payoutSchedule: defaultValues?.payoutSchedule ?? 'weekly',
    },
  });

  const payoutMethod = watch('payoutMethod');

  const submit = handleSubmit(async (values) => {
    if (!values.payoutMethod) {
      toast.error('Pick a payout method to continue');
      return;
    }
    try {
      await updateSettings({
        payouts: {
          payoutMethod: values.payoutMethod,
          payoutSchedule: values.payoutSchedule,
        },
      }).unwrap();
      toast.success('Payout method saved');
      onSubmit(values);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save payout settings';
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="font-serif text-xl text-stone-900">How would you like to get paid?</h2>
        <p className="text-sm text-stone-500 mt-1">
          You can connect a real account later — for now pick the method you plan to use.
        </p>
      </div>

      <div>
        <div className="text-sm font-medium text-stone-800 mb-2">Payout method</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAYOUT_METHODS.map((m) => (
            <label
              key={m.value}
              className="flex items-start gap-2.5 p-3 rounded-md border border-stone-200 cursor-pointer hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40"
            >
              <input
                type="radio"
                value={m.value}
                {...register('payoutMethod')}
                className="mt-0.5 accent-brand-700"
              />
              <div>
                <div className="text-sm font-medium text-stone-900">{m.label}</div>
                <div className="text-xs text-stone-500">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
        {errors.payoutMethod?.message && (
          <div className="text-xs text-red-600 mt-1">{errors.payoutMethod.message}</div>
        )}
      </div>

      {/* TODO(backend): expose POST /seller/me/settings/stripe/connect-link
          that returns a Stripe Connect onboarding URL we can redirect to. */}
      {payoutMethod === 'stripe' && (
        <div className="rounded-md bg-brand-50/50 border border-brand-200 p-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-stone-900">Connect Stripe later</div>
            <p className="text-xs text-stone-600 mt-0.5">
              We&apos;ll redirect you to Stripe&apos;s onboarding flow to verify your
              business and bank account. You can do this after the wizard.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled
            title="Stripe Connect onboarding is not wired up yet"
          >
            Connect Stripe
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        </div>
      )}

      <Field label="Payout schedule" error={errors.payoutSchedule?.message}>
        <Select {...register('payoutSchedule')}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </Select>
      </Field>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Back
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Next'}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Button>
      </div>
    </form>
  );
}

// ─── Step 3: shipping ───────────────────────────────────────────────────────

function Step3Shipping({
  onBack,
  onSkip,
  onSubmitted,
}: {
  onBack: () => void;
  onSkip: () => void;
  onSubmitted: (summary: { zoneName: string; method: string }) => void;
}) {
  const [createZone, { isLoading: creatingZone }] = useCreateZoneMutation();
  const [createRate, { isLoading: creatingRate }] = useCreateRateMutation();
  const saving = creatingZone || creatingRate;

  // The wizard collects zone + base rate in a single form to keep the
  // experience short. We compose the two API calls (create zone → create
  // its first rate) on submit.
  const zoneForm = useForm<ZoneFormInput, unknown, ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: 'Domestic',
      countries: ['US'],
      active: true,
      leadTimeDays: 5,
    },
    mode: 'onBlur',
  });

  const rateForm = useForm<RateFormInput, unknown, RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: {
      method: 'Standard',
      baseCostCents: 500,
      perItemCostCents: 0,
      perKgCostCents: 0,
      minDeliveryDays: 3,
      maxDeliveryDays: 7,
      active: true,
    },
    mode: 'onBlur',
  });

  const submit: SubmitHandler<ZoneFormValues> = async (zoneValues) => {
    // Validate the rate sub-form too before we hit the backend.
    const ok = await rateForm.trigger();
    if (!ok) return;
    const rateValues = rateForm.getValues() as RateFormValues;

    try {
      const zone = await createZone(zoneValues).unwrap();
      await createRate({ zoneId: zone._id, body: rateValues }).unwrap();
      toast.success(`Created zone "${zone.name}" with a base rate`);
      onSubmitted({ zoneName: zone.name, method: rateValues.method });
    } catch {
      toast.error('Failed to create shipping zone');
    }
  };

  const {
    register: registerZone,
    handleSubmit,
    formState: { errors: zoneErrors },
  } = zoneForm;
  const {
    register: registerRate,
    formState: { errors: rateErrors },
  } = rateForm;

  // The country select is single-pick here (multi-country gets configured
  // later in Settings → Shipping). We coerce to a 1-length array via a
  // hidden controlled input.
  const countryValue = zoneForm.watch('countries')?.[0] ?? 'US';

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-100 grid place-items-center shrink-0">
          <Truck className="w-4 h-4 text-brand-700" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-serif text-xl text-stone-900">Set up a default shipping zone</h2>
          <p className="text-sm text-stone-500 mt-1">
            Optional. Create one zone with a base rate so you can start selling immediately.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Zone name" required error={zoneErrors.name?.message}>
          <Input placeholder="Domestic" {...registerZone('name')} />
        </Field>
        <Field label="Country" required error={(zoneErrors.countries as { message?: string } | undefined)?.message}>
          <Select
            value={countryValue}
            onChange={(e) => zoneForm.setValue('countries', [e.target.value], { shouldValidate: true })}
          >
            {COUNTRY_OPTIONS.filter((c) => c.code).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Method" required error={rateErrors.method?.message}>
          <Input placeholder="Standard" {...registerRate('method')} />
        </Field>
        <Field
          label="Base cost (cents)"
          required
          hint="500 = $5.00"
          error={rateErrors.baseCostCents?.message}
        >
          <Input type="number" min={0} {...registerRate('baseCostCents')} />
        </Field>
        <Field label="Lead time (days)" required error={zoneErrors.leadTimeDays?.message}>
          <Input type="number" min={1} {...registerZone('leadTimeDays')} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Min delivery days" required error={rateErrors.minDeliveryDays?.message}>
          <Input type="number" min={0} {...registerRate('minDeliveryDays')} />
        </Field>
        <Field label="Max delivery days" required error={rateErrors.maxDeliveryDays?.message}>
          <Input type="number" min={1} {...registerRate('maxDeliveryDays')} />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create & continue'}
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Step 4: done ───────────────────────────────────────────────────────────

function Step4Done({
  state,
  onBack,
  onFinish,
}: {
  state: WizardState;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-100 grid place-items-center shrink-0">
          <PartyPopper className="w-5 h-5 text-brand-700" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-serif text-xl text-stone-900">You&apos;re all set!</h2>
          <p className="text-sm text-stone-500 mt-1">
            Your store basics are saved. Time to add your first product so customers have something to buy.
          </p>
        </div>
      </div>

      <ul className="text-sm text-stone-700 space-y-1.5">
        {state.profile?.displayName && (
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-brand-700" strokeWidth={2.5} />
            Store named <span className="font-medium">{state.profile.displayName}</span> ({state.profile.currency})
          </li>
        )}
        {state.payouts?.payoutMethod && (
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-brand-700" strokeWidth={2.5} />
            Payouts via <span className="font-medium capitalize">{state.payouts.payoutMethod}</span> ({state.payouts.payoutSchedule})
          </li>
        )}
        {state.shipping?.zoneName && (
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-brand-700" strokeWidth={2.5} />
            Shipping zone <span className="font-medium">{state.shipping.zoneName}</span> with {state.shipping.method} rate
          </li>
        )}
      </ul>

      <div className="rounded-md border border-brand-200 bg-brand-50/50 p-4">
        <div className="text-sm font-medium text-stone-900">Next: create your first product</div>
        <p className="text-xs text-stone-600 mt-1">
          Add a title, photos, price and inventory and your store is open for business.
        </p>
        <div className="mt-3">
          <Link
            href="/products/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-800"
          >
            Create your first product
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Back
        </Button>
        <Button type="button" variant="primary" onClick={onFinish}>
          Take me to my dashboard
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
