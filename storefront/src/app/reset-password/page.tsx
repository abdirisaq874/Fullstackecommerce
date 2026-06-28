'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { useResetPasswordMutation } from '@/store/api/authApi';

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>;
}

function ResetForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [reset, { isLoading }] = useResetPasswordMutation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t('pwMin')); return; }
    if (password !== confirm) { toast.error(t('pwMismatch')); return; }
    try {
      await reset({ token, newPassword: password }).unwrap();
      toast.success(t('resetDone'));
      router.push('/login');
    } catch {
      toast.error(t('resetInvalid'));
    }
  };

  return (
    <AuthShell title={t('resetTitle')} subtitle={t('resetSubtitle')} footer={<Link href="/login" className="font-bold text-brand hover:underline">{t('backToSignIn')}</Link>}>
      {!token ? (
        <div className="rounded-2xl border-2 border-danger/30 bg-danger/5 p-6 text-center text-sm font-semibold text-danger">
          {t('missingResetLink')}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('newPassword')} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock className="h-5 w-5" />} hint={t('passwordHintShort')} />
          <Input label={t('confirmPassword')} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} leftIcon={<Lock className="h-5 w-5" />} />
          <Button type="submit" size="lg" className="w-full" loading={isLoading}>{t('resetPassword')}</Button>
        </form>
      )}
    </AuthShell>
  );
}
