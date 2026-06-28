'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button, EmptyState } from '@/components/ui';
import { useAppSelector } from '@/store';
import {
  useListThreadsQuery, useGetThreadQuery, useReplyThreadMutation, useMarkThreadReadMutation,
} from '@/store/api/messagesApi';

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" />}>
      <MessagesView />
    </Suspense>
  );
}

function MessagesView() {
  const params = useSearchParams();
  const userId = useAppSelector((s) => s.auth.user?._id);
  const { data: threadsData, isLoading } = useListThreadsQuery({});
  const [selected, setSelected] = useState<string | null>(params.get('thread'));
  const [markRead] = useMarkThreadReadMutation();

  const threads = threadsData?.threads ?? [];

  useEffect(() => {
    if (selected) markRead(selected);
  }, [selected, markRead]);

  if (isLoading) return <div className="skeleton h-96" />;

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl font-bold">Messages</h2>
      {threads.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-12 w-12" />} title="No messages" description="Questions to sellers will appear here." />
      ) : (
        <div className="grid h-[70vh] grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:grid-cols-[300px_1fr]">
          {/* Thread list */}
          <ul className={cn('divide-y divide-line overflow-y-auto border-r border-line', selected && 'hidden md:block')}>
            {threads.map((t) => (
              <li key={t._id}>
                <button
                  onClick={() => setSelected(t._id)}
                  className={cn('w-full px-4 py-3 text-left transition hover:bg-muted', selected === t._id && 'bg-brand-50')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold">{t.subject}</p>
                    {!!t.unreadCountCustomer && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                  <p className="truncate text-sm text-muted-fg">{t.lastMessagePreview}</p>
                </button>
              </li>
            ))}
          </ul>
          {/* Conversation */}
          <div className={cn(!selected && 'hidden md:flex', 'flex flex-col')}>
            {selected ? (
              <Conversation threadId={selected} userId={userId} onBack={() => setSelected(null)} />
            ) : (
              <div className="grid flex-1 place-items-center text-muted-fg">Select a conversation</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Conversation({ threadId, userId, onBack }: { threadId: string; userId?: string; onBack: () => void }) {
  const { data, isLoading } = useGetThreadQuery(threadId);
  const [reply, { isLoading: sending }] = useReplyThreadMutation();
  const [body, setBody] = useState('');

  const messages = data?.messages.data ?? [];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try { await reply({ id: threadId, body: body.trim() }).unwrap(); setBody(''); }
    catch { toast.error('Could not send message'); }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line p-4">
        <button onClick={onBack} className="md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <p className="font-bold">{data?.thread.subject ?? 'Conversation'}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12" />)}</div>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === userId;
            return (
              <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[75%] rounded-2xl px-4 py-2 text-sm', mine ? 'bg-brand-gradient text-white' : 'bg-muted')}>
                  <p>{m.body}</p>
                  <p className={cn('mt-1 text-[11px]', mine ? 'text-white/70' : 'text-muted-fg')}>{formatDate(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-4">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" className="focus-ring h-11 flex-1 rounded-xl border-2 border-line px-4 focus:border-brand" />
        <Button type="submit" size="icon" loading={sending} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </>
  );
}
