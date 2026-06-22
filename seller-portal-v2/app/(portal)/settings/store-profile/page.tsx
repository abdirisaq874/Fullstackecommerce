'use client';

import { useEffect } from 'react';
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
import {
  storeProfileSchema,
  type StoreProfileFormValues,
} from '@/lib/schemas/seller-settings';
import { SettingsShell } from '../_components/settings-shell';

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

export default function StoreProfileSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const form = useForm<StoreProfileFormValues>({
    resolver: zodResolver(storeProfileSchema) as never,
    defaultValues: {
      displayName: '',
      slug: '',
      logoUrl: '',
      country: '',
      currency: 'USD',
      supportEmail: '',
      supportPhone: '',
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form;

  // Hydrate the form once settings come back from the server.
  useEffect(() => {
    if (!data) return;
    reset({
      displayName: data.storeProfile?.displayName ?? '',
      slug: data.storeProfile?.slug ?? '',
      logoUrl: data.storeProfile?.logoUrl ?? '',
      country: data.storeProfile?.country ?? '',
      currency: data.storeProfile?.currency ?? 'USD',
      supportEmail: data.storeProfile?.supportEmail ?? '',
      supportPhone: data.storeProfile?.supportPhone ?? '',
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings({
        storeProfile: {
          displayName: values.displayName || undefined,
          slug: values.slug || undefined,
          logoUrl: values.logoUrl || undefined,
          country: values.country || undefined,
          currency: values.currency,
          supportEmail: values.supportEmail || undefined,
          supportPhone: values.supportPhone || undefined,
        },
      }).unwrap();
      toast.success('Store profile saved');
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save store profile';
      toast.error(message);
    }
  });

  return (
    <SettingsShell
      title="Store profile"
      subtitle="How your storefront introduces itself to customers"
    >
      {isLoading ? (
        <CardSkeleton height={400} />
      ) : isError ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Display name" error={errors.displayName?.message}>
                <Input
                  placeholder="My Store"
                  {...register('displayName')}
                />
              </Field>
              <Field
                label="Store slug"
                hint="Used in your storefront URL. Lowercase letters, numbers, hyphens."
                error={errors.slug?.message}
              >
                <Input placeholder="my-store" {...register('slug')} />
              </Field>
            </div>

            <Field
              label="Logo URL"
              hint="Public image URL (https://...)"
              error={errors.logoUrl?.message}
            >
              <Input placeholder="https://cdn.example.com/logo.png" {...register('logoUrl')} />
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
              <Field
                label="Default currency"
                required
                error={errors.currency?.message}
              >
                <Select {...register('currency')}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Support email" error={errors.supportEmail?.message}>
                <Input
                  type="email"
                  placeholder="support@example.com"
                  {...register('supportEmail')}
                />
              </Field>
              <Field label="Support phone" error={errors.supportPhone?.message}>
                <Input placeholder="+1 555 123 4567" {...register('supportPhone')} />
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
      )}
    </SettingsShell>
  );
}
