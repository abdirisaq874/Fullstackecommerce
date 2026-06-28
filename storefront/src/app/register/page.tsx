'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { useRegisterMutation } from '@/store/api/authApi';

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}

function RegisterForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/account';
  const [register, { isLoading }] = useRegisterMutation();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error(t('pwMin')); return; }
    try {
      await register(form).unwrap();
      toast.success(t('accountCreated'));
      router.push(redirect);
    } catch (err: any) {
      toast.error(err?.data?.message?.toString() || t('couldNotCreate'));
    }
  };

  return (
    <AuthShell
      title={t('registerTitle')}
      subtitle={t('registerSubtitle')}
      footer={<>{t('haveAccount')} <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-brand hover:underline">{t('signIn')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('firstName')} required value={form.firstName} onChange={set('firstName')} />
          <Input label={t('lastName')} required value={form.lastName} onChange={set('lastName')} />
        </div>
        <Input label={t('emailLabel')} type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
        <Input label={t('phoneOptional')} value={form.phone} onChange={set('phone')} />
        <Input label={t('passwordLabel')} type="password" required value={form.password} onChange={set('password')} hint={t('passwordHint')} />
        <Button type="submit" size="lg" className="w-full" loading={isLoading}>{t('createAccount')}</Button>
        <p className="text-center text-xs text-muted-fg">{t('termsPre')} <Link href="/help#terms" className="underline">{t('terms')}</Link> {t('and')} <Link href="/help#privacy" className="underline">{t('privacy')}</Link>.</p>
      </form>
    </AuthShell>
  );
}
