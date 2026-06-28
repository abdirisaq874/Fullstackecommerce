'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Plus, Pencil, Trash2, Star, X } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { AddressForm } from '@/components/checkout/AddressForm';
import {
  useListAddressesQuery, useAddAddressMutation, useUpdateAddressMutation, useDeleteAddressMutation,
} from '@/store/api/usersApi';
import type { Address } from '@/types';

export default function AddressesPage() {
  const { data: addresses, isLoading } = useListAddressesQuery();
  const [addAddress, { isLoading: adding }] = useAddAddressMutation();
  const [updateAddress, { isLoading: updating }] = useUpdateAddressMutation();
  const [deleteAddress] = useDeleteAddressMutation();
  const [editing, setEditing] = useState<Address | null | 'new'>(null);

  const save = async (addr: Address) => {
    try {
      if (editing && editing !== 'new' && editing._id) await updateAddress({ id: editing._id, data: addr }).unwrap();
      else await addAddress(addr).unwrap();
      toast.success('Address saved');
      setEditing(null);
    } catch { toast.error('Could not save address'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Addresses</h2>
        <Button onClick={() => setEditing('new')} className="gap-2"><Plus className="h-4 w-4" /> Add address</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-40" />)}</div>
      ) : (addresses?.length ?? 0) === 0 ? (
        <EmptyState icon={<MapPin className="h-12 w-12" />} title="No saved addresses" description="Add an address for faster checkout."
          action={<Button onClick={() => setEditing('new')}>Add address</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses!.map((a) => (
            <div key={a._id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">{a.fullName}</p>
                {a.isDefault && <span className="inline-flex items-center gap-1 text-xs font-bold text-brand"><Star className="h-3.5 w-3.5 fill-brand" /> Default</span>}
              </div>
              <p className="text-sm text-muted-fg">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
              <p className="text-sm text-muted-fg">{a.city} {a.state} {a.postalCode}, {a.countryCode}</p>
              {a.phone && <p className="text-sm text-muted-fg">{a.phone}</p>}
              <div className="mt-4 flex items-center gap-3 text-sm font-semibold">
                <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1 text-brand hover:underline"><Pencil className="h-4 w-4" /> Edit</button>
                {!a.isDefault && (
                  <button onClick={() => updateAddress({ id: a._id!, data: { isDefault: true } })} className="text-muted-fg hover:text-brand">Set default</button>
                )}
                <button onClick={() => deleteAddress(a._id!)} className="ml-auto inline-flex items-center gap-1 text-muted-fg hover:text-danger"><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift" style={{ maxHeight: '90vh' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">{editing === 'new' ? 'Add address' : 'Edit address'}</h3>
              <button onClick={() => setEditing(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <AddressForm
              defaultValue={editing === 'new' ? undefined : editing}
              submitLabel="Save address"
              loading={adding || updating}
              onSubmit={save}
            />
          </div>
        </div>
      )}
    </div>
  );
}
