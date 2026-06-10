'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} from '@/lib/api/seller-settings-api';
import {
  notificationsSchema,
  type NotificationsFormValues,
} from '@/lib/schemas/seller-settings';
import { SettingsShell } from '../_components/settings-shell';

interface ToggleConfig {
  name: keyof NotificationsFormValues;
  label: string;
  description: string;
}

const TOGGLES: ToggleConfig[] = [
  { name: 'newOrderEmail',      label: 'New orders',       description: 'A buyer paid for one of your products' },
  { name: 'lowStockEmail',      label: 'Low stock',        description: 'A variant dropped below its reorder point' },
  { name: 'returnRequestEmail', label: 'Return requests',  description: 'A customer initiated a return / RMA' },
  { name: 'messageEmail',       label: 'New messages',     description: 'A buyer or admin messaged your store' },
];

export default function NotificationsSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();

  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsSchema) as never,
    defaultValues: {
      newOrderEmail: true,
      lowStockEmail: true,
      returnRequestEmail: true,
      messageEmail: true,
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (!data) return;
    reset({
      newOrderEmail: data.notifications?.newOrderEmail ?? true,
      lowStockEmail: data.notifications?.lowStockEmail ?? true,
      returnRequestEmail: data.notifications?.returnRequestEmail ?? true,
      messageEmail: data.notifications?.messageEmail ?? true,
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings({ notifications: values }).unwrap();
      toast.success('Notification preferences saved');
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        'Failed to save notification preferences';
      toast.error(message);
    }
  });

  return (
    <SettingsShell
      title="Notifications"
      subtitle="Choose which emails we send to your support inbox"
    >
      {isLoading ? (
        <CardSkeleton height={320} />
      ) : isError ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-2">
            {TOGGLES.map((t) => (
              <label
                key={t.name}
                className="flex items-start gap-3 p-3 rounded-md border border-stone-200 cursor-pointer hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40"
              >
                <input
                  type="checkbox"
                  {...register(t.name)}
                  className="mt-0.5 accent-brand-700"
                />
                <div>
                  <div className="text-sm font-medium text-stone-900">{t.label}</div>
                  <div className="text-xs text-stone-500">{t.description}</div>
                </div>
              </label>
            ))}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100 mt-4">
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
