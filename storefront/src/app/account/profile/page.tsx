'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui';
import { useAppSelector } from '@/store';
import { useUpdateProfileMutation, useChangePasswordMutation } from '@/store/api/usersApi';

export default function ProfilePage() {
  const user = useAppSelector((s) => s.auth.user);
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changing }] = useChangePasswordMutation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  useEffect(() => {
    if (user) { setFirstName(user.firstName || ''); setLastName(user.lastName || ''); setPhone(user.phone || ''); }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await updateProfile({ firstName, lastName, phone }).unwrap(); toast.success('Profile updated'); }
    catch { toast.error('Could not update profile'); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword({ currentPassword: current, newPassword: next }).unwrap();
      toast.success('Password changed');
      setCurrent(''); setNext('');
    } catch { toast.error('Could not change password. Check your current password.'); }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Profile & settings</h2>

      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h3 className="font-bold">Personal details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input label="Email" value={user?.email ?? ''} disabled hint="Contact support to change your email." />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" loading={saving}>Save changes</Button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h3 className="font-bold">Change password</h3>
        <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} required hint="At least 8 characters, with upper/lowercase and a number or symbol." />
        <Button type="submit" loading={changing} disabled={!current || !next}>Update password</Button>
      </form>
    </div>
  );
}
