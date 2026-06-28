import { apiSlice } from './apiSlice';
import { toQuery } from '@/lib/utils';
import type { Message, MessageThread, Paginated } from '@/types';

interface ThreadDetail {
  thread: MessageThread;
  messages: Paginated<Message>;
}

export const messagesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listThreads: builder.query<{ threads: MessageThread[]; total: number }, { page?: number; status?: string; search?: string }>({
      query: (params) => `/messages/threads?${toQuery(params as Record<string, unknown>)}`,
      providesTags: ['Threads'],
    }),
    getThread: builder.query<ThreadDetail, string>({
      query: (id) => `/messages/threads/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Thread', id }],
    }),
    createThread: builder.mutation<ThreadDetail, { recipientUserId: string; subject: string; body: string; relatedOrderId?: string }>({
      query: (body) => ({ url: '/messages/threads', method: 'POST', body }),
      invalidatesTags: ['Threads'],
    }),
    replyThread: builder.mutation<Message, { id: string; body: string }>({
      query: ({ id, body }) => ({ url: `/messages/threads/${id}/messages`, method: 'POST', body: { body } }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Thread', id: a.id }, 'Threads'],
    }),
    markThreadRead: builder.mutation<{ modified: number }, string>({
      query: (id) => ({ url: `/messages/threads/${id}/read`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Thread', id }, 'Threads'],
    }),
  }),
});

export const {
  useListThreadsQuery,
  useGetThreadQuery,
  useCreateThreadMutation,
  useReplyThreadMutation,
  useMarkThreadReadMutation,
} = messagesApi;
