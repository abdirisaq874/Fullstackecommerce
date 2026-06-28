'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Lock } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { useLoginMutation } from '@/store/api/authApi';

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/account';
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password }).unwrap();
      toast.success(t('welcomeBack'));
      router.push(redirect);
    } catch {
      toast.error(t('invalidCreds'));
    }
  };

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={<>{t('newHere')} <Link href={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-brand hover:underline">{t('createAnAccount')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('emailLabel')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail className="h-5 w-5" />} placeholder="you@example.com" />
        <Input label={t('passwordLabel')} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock className="h-5 w-5" />} placeholder="••••••••" />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">{t('forgot')}</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isLoading}>{t('signIn')}</Button>
      </form>
    </AuthShell>
  );
}
