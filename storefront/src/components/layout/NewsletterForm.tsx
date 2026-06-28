'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function NewsletterForm() {
  const t = useTranslations('footer');
  const [email, setEmail] = useState('');
  return (
    <form
      className="mt-4 flex max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) { toast.success('Subscribed! Watch your inbox for deals.'); setEmail(''); }
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('newsletter')}
        className="focus-ring h-11 flex-1 rounded-xl border-2 border-line bg-surface px-4 text-sm"
        aria-label={t('newsletter')}
      />
      <button className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-white">{t('join')}</button>
    </form>
  );
}
