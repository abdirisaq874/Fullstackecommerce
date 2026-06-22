'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Field, Input, Select } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} from '@/lib/api/seller-settings-api';
import { useListZonesQuery } from '@/lib/api/shipping-api';
import {
  shippingDefaultsSchema,
  type ShippingDefaultsFormValues,
} from '@/lib/schemas/seller-settings';
import { SettingsShell } from '../_components/settings-shell';

export default function ShippingDefaultsSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const {
    data: zones = [],
    isLoading: zonesLoading,
    isError: zonesError,
    refetch: refetchZones,
  } = useListZonesQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const form = useForm<ShippingDefaultsFormValues>({
    resolver: zodResolver(shippingDefaultsSchema) as never,
    defaultValues: {
      defaultZoneId: '',
      defaultHandlingDays: '1',
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form;

  useEffect(() => {
    if (!data) return;
    reset({
      defaultZoneId: data.shippingDefaults?.defaultZoneId ?? '',
      defaultHandlingDays: String(data.shippingDefaults?.defaultHandlingDays ?? 1),
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings({
        shippingDefaults: {
          defaultZoneId: values.defaultZoneId || undefined,
          defaultHandlingDays: Number(values.defaultHandlingDays),
        },
      }).unwrap();
      toast.success('Shipping defaults saved');
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save shipping defaults';
      toast.error(message);
    }
  });

  const loading = isLoading || zonesLoading;
  const errored = isError || zonesError;

  return (
    <SettingsShell
      title="Shipping defaults"
      subtitle="Fallback zone and handling time used by new products"
    >
      {loading ? (
        <CardSkeleton height={300} />
      ) : errored ? (
        <Card>
          <ErrorState
            onRetry={() => {
              if (isError) refetch();
              if (zonesError) refetchZones();
            }}
          />
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Default shipping zone"
              hint={
                zones.length === 0 ? (
                  <>
                    No zones yet — <Link href="/shipping" className="text-brand-700 hover:underline">create one</Link> to enable this.
                  </>
                ) : (
                  'Used when a product has no explicit zone configured.'
                )
              }
              error={errors.defaultZoneId?.message}
            >
              <Select {...register('defaultZoneId')}>
                <option value="">— None —</option>
                {zones.map((z) => (
                  <option key={z._id} value={z._id}>
                    {z.name}
                    {z.active === false ? ' (inactive)' : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Default handling days"
              required
              hint="Business days between order paid and parcel handed to carrier."
              error={errors.defaultHandlingDays?.message}
            >
              <Input
                type="number"
                min={0}
                step={1}
                {...register('defaultHandlingDays')}
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
