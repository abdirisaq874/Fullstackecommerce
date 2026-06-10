'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Field, Input } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} from '@/lib/api/seller-settings-api';
import {
  taxSchema,
  type TaxFormValues,
} from '@/lib/schemas/seller-settings';
import { SettingsShell } from '../_components/settings-shell';

export default function TaxSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const form = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema) as never,
    defaultValues: {
      taxId: '',
      taxExempt: false,
      defaultTaxRatePercent: '',
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  useEffect(() => {
    if (!data) return;
    const ratePercent =
      typeof data.tax?.defaultTaxRate === 'number'
        // Backend stores 0..1; surface as a 0..100 percent.
        ? String(Math.round(data.tax.defaultTaxRate * 10_000) / 100)
        : '';
    reset({
      taxId: data.tax?.taxId ?? '',
      taxExempt: data.tax?.taxExempt ?? false,
      defaultTaxRatePercent: ratePercent,
    });
  }, [data, reset]);

  const taxExempt = watch('taxExempt');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const ratePercent = values.defaultTaxRatePercent?.trim();
      const defaultTaxRate =
        ratePercent && ratePercent !== ''
          ? Math.round(Number(ratePercent) * 100) / 10_000 // 18 → 0.18
          : undefined;
      await updateSettings({
        tax: {
          taxId: values.taxId || undefined,
          taxExempt: values.taxExempt,
          defaultTaxRate,
        },
      }).unwrap();
      toast.success('Tax settings saved');
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save tax settings';
      toast.error(message);
    }
  });

  return (
    <SettingsShell title="Tax & invoicing" subtitle="How tax is calculated for your sales">
      {isLoading ? (
        <CardSkeleton height={320} />
      ) : isError ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Tax ID / VAT number"
              hint="Used on invoices issued to your customers"
              error={errors.taxId?.message}
            >
              <Input placeholder="EU123456789" {...register('taxId')} />
            </Field>

            <div>
              <label className="flex items-start gap-2.5 p-3 rounded-md border border-stone-200 cursor-pointer hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40">
                <input
                  type="checkbox"
                  checked={!!taxExempt}
                  onChange={(e) => setValue('taxExempt', e.target.checked, { shouldDirty: true })}
                  className="mt-0.5 accent-brand-700"
                />
                <div>
                  <div className="text-sm font-medium text-stone-900">Tax exempt</div>
                  <div className="text-xs text-stone-500">
                    Skip tax calculation on this store's orders (e.g. wholesale).
                  </div>
                </div>
              </label>
            </div>

            <Field
              label="Default tax rate (%)"
              hint="Applied when no jurisdiction-specific rate matches"
              error={errors.defaultTaxRatePercent?.message}
            >
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="0"
                disabled={taxExempt}
                {...register('defaultTaxRatePercent')}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <Button type="submit" variant="primary" disabled={saving || !isDirty}>
                <Save className="w-4 h-4" strokeWidth={2} />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </SettingsShell>
  );
}
