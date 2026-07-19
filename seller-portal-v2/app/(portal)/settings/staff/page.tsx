'use client';

import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Input, Select } from '@/components/primitives/field';
import { EmptyState, TableSkeleton } from '@/components/data/states';
import {
  useListMyStoresQuery,
  useListStoreMembersQuery,
  useAddStoreMemberMutation,
  useUpdateStoreMemberMutation,
  useRemoveStoreMemberMutation,
  type StoreRole,
} from '@/lib/api/stores-api';
import { getActiveStoreId } from '@/lib/api/base-api';
import { useToast } from '@/lib/hooks/use-toast';

const ROLE_RANK: Record<StoreRole, number> = { owner: 3, manager: 2, staff: 1 };

export default function StaffPage() {
  const toast = useToast();
  const storeId = typeof window !== 'undefined' ? getActiveStoreId() : null;
  const { data: stores = [] } = useListMyStoresQuery();
  const store = useMemo(() => stores.find((s) => s._id === storeId) ?? stores.find((s) => s.myRole === 'owner') ?? stores[0], [stores, storeId]);
  const effectiveId = store?._id;
  const myRole = store?.myRole;
  const canManage = myRole === 'owner' || myRole === 'manager';

  const { data: members = [], isLoading } = useListStoreMembersQuery(effectiveId!, { skip: !effectiveId });
  const [addMember, { isLoading: adding }] = useAddStoreMemberMutation();
  const [updateMember] = useUpdateStoreMemberMutation();
  const [removeMember] = useRemoveStoreMemberMutation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StoreRole>('staff');

  const onAdd = async () => {
    if (!effectiveId || !email.trim()) return;
    try {
      await addMember({ storeId: effectiveId, email: email.trim(), role }).unwrap();
      toast.success(`Added ${email.trim()} as ${role}`);
      setEmail('');
    } catch (e) {
      toast.error((e as { data?: { message?: string } })?.data?.message || 'Could not add member');
    }
  };
  const onRole = async (userId: string, next: StoreRole) => {
    if (!effectiveId) return;
    try {
      await updateMember({ storeId: effectiveId, userId, role: next }).unwrap();
      toast.success('Role updated');
    } catch (e) {
      toast.error((e as { data?: { message?: string } })?.data?.message || 'Could not update role');
    }
  };
  const onRemove = async (userId: string) => {
    if (!effectiveId) return;
    try {
      await removeMember({ storeId: effectiveId, userId }).unwrap();
      toast.success('Member removed');
    } catch (e) {
      toast.error((e as { data?: { message?: string } })?.data?.message || 'Could not remove member');
    }
  };

  // The roles the current user may grant: strictly below their own.
  const grantable: StoreRole[] = myRole === 'owner' ? ['manager', 'staff'] : myRole === 'manager' ? ['staff'] : [];

  return (
    <>
      <PageHeader title="Staff" subtitle={store ? `Team for ${store.displayName}` : 'Team members'} />

      {canManage && grantable.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-sm font-medium">Add a member by email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" type="email" />
            </div>
            <div className="w-40">
              <label className="mb-1 block text-sm font-medium">Role</label>
              <Select value={role} onChange={(e) => setRole(e.target.value as StoreRole)}>
                {grantable.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <Button variant="primary" onClick={onAdd} disabled={adding || !email.trim()}>
              <UserPlus className="w-3.5 h-3.5" /> {adding ? 'Adding…' : 'Add'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-stone-500">They must already have an account. Email invitations arrive with the messaging system.</p>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : members.length === 0 ? (
          <EmptyState title="No members yet" description="Add teammates to help manage this store." />
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-forest-900">
            {members.map((m) => {
              // May act on a member only if strictly outranking them.
              const canEdit = canManage && myRole && ROLE_RANK[myRole] > ROLE_RANK[m.role];
              return (
                <li key={m.userId} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{m.name || m.email || m.userId}</div>
                    <div className="text-xs text-stone-500 truncate">{m.email}</div>
                  </div>
                  {m.role === 'owner' || !canEdit ? (
                    <Badge variant={m.role === 'owner' ? 'success' : 'neutral'}>{m.role}</Badge>
                  ) : (
                    <Select value={m.role} onChange={(e) => onRole(m.userId, e.target.value as StoreRole)} className="w-32">
                      {grantable.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onRemove(m.userId)}
                      className="p-1.5 text-stone-400 hover:text-red-600"
                      aria-label={`Remove ${m.email}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
