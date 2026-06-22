import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import type { MessageThread, Message } from '@/lib/types';

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMessages: builder.query<MessageThread[], void>({
      async queryFn() {
        await delay(180);
        return { data: db.messages };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Message', id: 'LIST' }, ...result.map(m => ({ type: 'Message' as const, id: m.id }))]
          : [{ type: 'Message', id: 'LIST' }],
    }),

    getThread: builder.query<MessageThread | undefined, string>({
      async queryFn(id) {
        await delay(120);
        return { data: db.messages.find(m => m.id === id) };
      },
      providesTags: (_, __, id) => [{ type: 'Message', id }],
    }),

    markRead: builder.mutation<void, string>({
      async queryFn(id) {
        await delay(80);
        db.messages = db.messages.map(m => m.id === id ? { ...m, status: m.status === 'replied' ? 'replied' : 'read', unreadCount: 0 } : m);
        return { data: undefined };
      },
      invalidatesTags: (_, __, id) => [{ type: 'Message', id }, { type: 'Message', id: 'LIST' }],
    }),

    replyToThread: builder.mutation<MessageThread, { id: string; body: string }>({
      async queryFn({ id, body }) {
        await delay(300);
        const idx = db.messages.findIndex(m => m.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const thread = db.messages[idx];
        const newMsg: Message = { id: `m_${Date.now()}`, from: 'seller', body, sentAt: 'Just now' };
        const updated: MessageThread = {
          ...thread,
          status: 'replied',
          unreadCount: 0,
          lastMessageAt: 'Just now',
          messages: [...thread.messages, newMsg],
          preview: body.slice(0, 80),
        };
        // New array, not in-place — the cached array is frozen by RTK/Immer.
        db.messages = db.messages.map((m, i) => (i === idx ? updated : m));
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [{ type: 'Message', id }, { type: 'Message', id: 'LIST' }],
    }),
  }),
});

export const {
  useListMessagesQuery,
  useGetThreadQuery,
  useMarkReadMutation,
  useReplyToThreadMutation,
} = messagesApi;
