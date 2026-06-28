'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { Address } from '@/types';

const EMPTY: Address = {
  fullName: '', line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: '', phone: '', label: '',
};

export function AddressForm({
  defaultValue, onSubmit, submitLabel = 'Save address', loading, showSaveToggle,
}: {
  defaultValue?: Partial<Address>;
  onSubmit: (address: Address, save?: boolean) => void;
  submitLabel?: string;
  loading?: boolean;
  showSaveToggle?: boolean;
}) {
  const [v, setV] = useState<Address>({ ...EMPTY, ...defaultValue });
  const [save, setSave] = useState(true);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(v, showSaveToggle ? save : undefined);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Full name" required value={v.fullName} onChange={set('fullName')} />
      <Input label="Address line 1" required value={v.line1} onChange={set('line1')} />
      <Input label="Address line 2 (optional)" value={v.line2} onChange={set('line2')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="City" required value={v.city} onChange={set('city')} />
        <Input label="State / Region" value={v.state} onChange={set('state')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Postal code" required value={v.postalCode} onChange={set('postalCode')} />
        <Input label="Country code" required maxLength={2} placeholder="US" value={v.countryCode} onChange={set('countryCode')} className="uppercase" />
      </div>
      <Input label="Phone (optional)" value={v.phone} onChange={set('phone')} />
      {showSaveToggle && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--brand))]" />
          Save this address to my account
        </label>
      )}
      <Button type="submit" loading={loading} className="w-full">{submitLabel}</Button>
    </form>
  );
}
