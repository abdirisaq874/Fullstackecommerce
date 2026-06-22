'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save, ExternalLink } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Field, Input, Select } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} from '@/lib/api/seller-settings-api';
import {
  payoutsSchema,
  type PayoutsFormValues,
} from '@/lib/schemas/seller-settings';
import { SettingsShell } from '../_components/settings-shell';

const PAYOUT_METHODS: Array<{ value: PayoutsFormValues['payoutMethod']; label: string; description: string }> = [
  { value: 'stripe', label: 'Stripe',  description: 'Connected Stripe account (recommended)' },
  { value: 'bank',   label: 'Bank',    description: 'Direct deposit to your bank' },
  { value: 'paypal', label: 'PayPal',  description: 'Payouts via PayPal email' },
];

const SCHEDULE_OPTIONS: PayoutsFormValues['payoutSchedule'][] = ['weekly', 'biweekly', 'monthly'];

export default function PayoutsSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const form = useForm<PayoutsFormValues>({
    resolver: zodResolver(payoutsSchema) as never,
    defaultValues: {
      stripeConnectAccountId: '',
      payoutMethod: undefined,
      bankAccountLast4: '',
      payoutSchedule: 'weekly',
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = form;

  useEffect(() => {
    if (!data) return;
    reset({
      stripeConnectAccountId: data.payouts?.stripeConnectAccountId ?? '',
      payoutMethod: data.payouts?.payoutMethod,
      bankAccountLast4: data.payouts?.bankAccountLast4 ?? '',
      payoutSchedule: (data.payouts?.payoutSchedule as PayoutsFormValues['payoutSchedule']) ?? 'weekly',
    });
  }, [data, reset]);

  const stripeConnectAccountId = watch('stripeConnectAccountId') ?? '';
  const bankAccountLast4 = watch('bankAccountLast4') ?? '';

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings({
        payouts: {
          // stripeConnectAccountId is display-only; we still echo it back so
          // the backend doesn't lose it on a $set replacement.
          stripeConnectAccountId: stripeConnectAccountId || undefined,
          payoutMethod: values.payoutMethod,
          bankAccountLast4: bankAccountLast4 || undefined,
          payoutSchedule: values.payoutSchedule,
        },
      }).unwrap();
      toast.success('Payout settings saved');
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save payout settings';
      toast.error(message);
    }
  });

  return (
    <SettingsShell
      title="Payouts & banking"
      subtitle="Where and how often we send your earnings"
    >
      {isLoading ? (
        <CardSkeleton height={420} />
      ) : isError ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Stripe Connect status (display-only). */}
          <Card className="p-5">
            <h3 className="text-sm font-medium text-stone-900 mb-1">Stripe Connect</h3>
            <p className="text-xs text-stone-500 mb-3">
              We use Stripe Connect to send your payouts. Connecting takes about a minute.
            </p>
            {stripeConnectAccountId ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-stone-50 border border-stone-200">
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-500">Connected account</div>
                  <div className="text-sm text-stone-900 font-mono">{stripeConnectAccountId}</div>
                </div>
                <Button type="button" variant="secondary" disabled>
                  Manage on Stripe
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled
                title="Stripe Connect onboarding is not wired up yet"
              >
                Connect Stripe
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            )}
            {/* TODO(backend): expose POST /seller/me/settings/stripe/connect-link
                that returns a Stripe Connect onboarding URL we can redirect to. */}
          </Card>

          <Card className="p-5">
            <form onSubmit={onSubmit} className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Bank account (last 4)"
                  hint="Read-only — managed through your bank verification flow"
                  error={errors.bankAccountLast4?.message}
                >
                  <Input
                    value={bankAccountLast4}
                    readOnly
                    placeholder="Not connected"
                    className="bg-stone-50"
                  />
                </Field>
                <Field
                  label="Payout schedule"
                  error={errors.payoutSchedule?.message}
                >
                  <Select {...register('payoutSchedule')}>
                    {SCHEDULE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || !isDirty}
                >
                  <Save className="w-4 h-4" strokeWidth={2} />
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </SettingsShell>
  );
}
