'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Mail, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { useForgotPasswordMutation } from '@/store/api/authApi';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await forgot({ email }).unwrap(); } catch { /* always succeed silently */ }
    setSent(true);
  };

  return (
    <AuthShell
      title={t('forgotTitle')}
      subtitle={t('forgotSubtitle')}
      footer={<>{t('remembered')} <Link href="/login" className="font-bold text-brand hover:underline">{t('backToSignIn')}</Link></>}
    >
      {sent ? (
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 font-bold">{t('checkInbox')}</p>
          <p className="mt-1 text-sm text-muted-fg">{t('resetSentTo', { email })}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('emailLabel')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail className="h-5 w-5" />} placeholder="you@example.com" />
          <Button type="submit" size="lg" className="w-full" loading={isLoading}>{t('sendResetLink')}</Button>
        </form>
      )}
    </AuthShell>
  );
}
