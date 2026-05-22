'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Mail } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Textarea } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { useGetThreadQuery, useReplyToThreadMutation, useMarkReadMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import clsx from 'clsx';

export default function MessageThreadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: thread, isLoading, isError, refetch } = useGetThreadQuery(params.id);
  const [reply, { isLoading: sending }] = useReplyToThreadMutation();
  const [markRead] = useMarkReadMutation();
  const toast = useToast();
  const [body, setBody] = useState('');

  // Mark as read when opened
  useEffect(() => {
    if (thread && thread.status === 'unread') markRead(thread.id);
  }, [thread, markRead]);

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !thread) return <CardSkeleton height={400} />;

  const send = async () => {
    if (!body.trim()) return;
    await reply({ id: thread.id, body: body.trim() }).unwrap();
    toast.success('Reply sent');
    setBody('');
  };

  return (
    <>
      <button onClick={() => router.push('/messages')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to inbox
      </button>

      <PageHeader
        title={thread.subject}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            From <strong className="text-stone-900">{thread.customer}</strong>
            <span className="text-stone-300">·</span>
            <Mail className="w-3 h-3" />
            <span className="text-stone-600">{thread.customerEmail}</span>
            {thread.orderId && (
              <>
                <span className="text-stone-300">·</span>
                <Link href={`/orders/${thread.orderId}`} className="font-mono text-brand-700 hover:text-brand-800">Order {thread.orderId}</Link>
              </>
            )}
          </span>
        }
      />

      <div className="max-w-3xl mx-auto">
        <Card className="p-5 mb-4">
          <div className="space-y-4">
            {thread.messages.map(m => (
              <div
                key={m.id}
                className={clsx(
                  'flex gap-3',
                  m.from === 'seller' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-full grid place-items-center text-xs font-medium shrink-0',
                  m.from === 'seller'
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-stone-200 text-stone-700'
                )}>
                  {m.from === 'seller' ? 'AT' : thread.customer.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className={clsx(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  m.from === 'seller'
                    ? 'bg-brand-700 text-white rounded-tr-sm'
                    : 'bg-stone-100 text-stone-900 rounded-tl-sm'
                )}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  <div className={clsx(
                    'text-2xs mt-1',
                    m.from === 'seller' ? 'text-brand-200' : 'text-stone-500'
                  )}>{m.sentAt}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Reply composer */}
        <Card className="p-4">
          <Textarea
            rows={4}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Reply to ${thread.customer}…`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-stone-500">
              Press <kbd className="border border-stone-200 rounded px-1 py-0.5 text-2xs">⌘ Enter</kbd> to send
            </span>
            <Button variant="primary" onClick={send} disabled={sending || !body.trim()}>
              <Send className="w-3.5 h-3.5" /> Send reply
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
