/**
 * Messages RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `MessagesController` (Phase 2 F8) endpoints:
 *   GET    /messages/threads               (list)
 *   GET    /messages/threads/:id           (detail + paginated messages)
 *   POST   /messages/threads               (create thread + first message)
 *   POST   /messages/threads/:id/messages  (reply)
 *   PATCH  /messages/threads/:id/read      (mark all read for me)
 *
 * Response envelope is unwrapped per-endpoint via `unwrapEnvelope`. The list
 * endpoint returns the backend's `PaginatedResponseDto<MessageThread>` shape
 * ({ data, meta }); we expose `.data` to callers so the existing
 * `useListMessagesQuery()` consumers continue to receive a plain array.
 */
import { baseApi, unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';
import type { MessageThread, Message, MessageStatus } from '@/lib/types';

// --- request param shapes ---------------------------------------------------

export interface ListThreadsParams {
  page?: number;
  limit?: number;
  status?: MessageStatus;
  search?: string;
  unreadOnly?: boolean;
}

export interface GetThreadParams {
  id: string;
  messagePage?: number;
  messageLimit?: number;
}

export interface CreateThreadBody {
  recipientUserId: string;
  subject: string;
  body: string;
  relatedOrderId?: string;
}

export interface ReplyThreadBody {
  id: string;
  body: string;
  attachments?: Array<{ url: string; name: string; contentType?: string; sizeBytes?: number }>;
}

// --- backend response shapes ------------------------------------------------

interface PaginatedThreads {
  data: MessageThread[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// --- endpoint slice ---------------------------------------------------------

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMessages: builder.query<MessageThread[], ListThreadsParams | void>({
      query: (params) => ({
        url: '/messages/threads',
        method: 'GET',
        params: params ?? undefined,
      }),
      transformResponse: (res: ResponseEnvelope<PaginatedThreads> | PaginatedThreads) => {
        const unwrapped = unwrapEnvelope<PaginatedThreads>(res);
        return unwrapped?.data ?? [];
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Message', id: 'LIST' }, ...result.map(m => ({ type: 'Message' as const, id: m.id }))]
          : [{ type: 'Message', id: 'LIST' }],
    }),

    getThread: builder.query<MessageThread | undefined, string | GetThreadParams>({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const params = typeof arg === 'string'
          ? undefined
          : {
              ...(arg.messagePage !== undefined ? { messagePage: arg.messagePage } : {}),
              ...(arg.messageLimit !== undefined ? { messageLimit: arg.messageLimit } : {}),
            };
        return {
          url: `/messages/threads/${id}`,
          method: 'GET',
          params,
        };
      },
      transformResponse: (res: ResponseEnvelope<MessageThread> | MessageThread) =>
        unwrapEnvelope<MessageThread>(res),
      providesTags: (_, __, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [{ type: 'Message', id }];
      },
    }),

    createThread: builder.mutation<MessageThread, CreateThreadBody>({
      query: (body) => ({
        url: '/messages/threads',
        method: 'POST',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<MessageThread> | MessageThread) =>
        unwrapEnvelope<MessageThread>(res),
      invalidatesTags: [{ type: 'Message', id: 'LIST' }],
    }),

    markRead: builder.mutation<void, string>({
      query: (id) => ({
        url: `/messages/threads/${id}/read`,
        method: 'PATCH',
      }),
      transformResponse: (res: ResponseEnvelope<void> | void) =>
        unwrapEnvelope<void>(res as ResponseEnvelope<void>),
      invalidatesTags: (_, __, id) => [{ type: 'Message', id }, { type: 'Message', id: 'LIST' }],
    }),

    replyToThread: builder.mutation<Message, ReplyThreadBody>({
      query: ({ id, body, attachments }) => ({
        url: `/messages/threads/${id}/messages`,
        method: 'POST',
        body: { body, ...(attachments ? { attachments } : {}) },
      }),
      transformResponse: (res: ResponseEnvelope<Message> | Message) =>
        unwrapEnvelope<Message>(res),
      invalidatesTags: (_, __, { id }) => [{ type: 'Message', id }, { type: 'Message', id: 'LIST' }],
    }),
  }),
});

export const {
  useListMessagesQuery,
  useGetThreadQuery,
  useCreateThreadMutation,
  useMarkReadMutation,
  useReplyToThreadMutation,
} = messagesApi;
