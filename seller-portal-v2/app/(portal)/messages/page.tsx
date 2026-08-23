'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MailOpen, Mail } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Input } from '@/components/primitives/field';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { useListMessagesQuery } from '@/lib/api';
import clsx from 'clsx';

export default function MessagesPage() {
  const router = useRouter();
  const { data: threads = [], isLoading, isError, refetch } = useListMessagesQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all');

  const filtered = useMemo(() => threads.filter(t => {
    if (filter === 'unread'  && t.status !== 'unread')  return false;
    if (filter === 'replied' && t.status !== 'replied') return false;
    if (search) {
      const q = search.toLowerCase();
      return t.customer.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
    }
    return true;
  }), [threads, search, filter]);

  const counts = {
    all: threads.length,
    unread: threads.filter(t => t.status === 'unread').length,
    replied: threads.filter(t => t.status === 'replied').length,
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader title="Messages" subtitle={`${counts.unread} unread of ${counts.all} conversations`} />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
            {(['all', 'unread', 'replied'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5 capitalize',
                  filter === opt ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                {opt}
                <span className="text-stone-400">{counts[opt]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer or subject…" className="!pl-9" />
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No messages" description="Customer messages will appear here." icon={Mail} />
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map(t => (
              <Link
                key={t.id}
                href={`/messages/${t.id}`}
                className={clsx(
                  'flex items-start gap-3 px-5 py-4 hover:bg-stone-50/50 transition-colors',
                  t.status === 'unread' && 'bg-brand-50/20'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-stone-200 text-stone-700 grid place-items-center font-medium text-sm shrink-0">
                  {(t.customer ?? '').split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={clsx('truncate', t.status === 'unread' ? 'text-stone-900 font-medium' : 'text-stone-700')}>{t.customer}</span>
                    {t.orderId && <Link onClick={(e) => e.stopPropagation()} href={`/orders/${t.orderId}`} className="text-2xs font-mono text-brand-700 hover:text-brand-800">{t.orderId}</Link>}
                    <span className="text-xs text-stone-400 ml-auto shrink-0">{t.lastMessageAt}</span>
                  </div>
                  <div className={clsx('text-sm truncate', t.status === 'unread' ? 'text-stone-900 font-medium' : 'text-stone-700')}>
                    {t.subject}
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-0.5">{t.preview}</div>
                </div>
                <div className="shrink-0">
                  {t.status === 'unread' && <Badge variant="warning">Unread</Badge>}
                  {t.status === 'replied' && <Badge variant="success">Replied</Badge>}
                  {t.status === 'read' && <MailOpen className="w-3.5 h-3.5 text-stone-400" />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
