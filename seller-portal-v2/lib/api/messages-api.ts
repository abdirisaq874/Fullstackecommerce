/**
 * Messages RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `MessagesController` (prefix /messages):
 *   GET    /messages/threads               (list, paginated)
 *   GET    /messages/threads/:id           (detail + paginated messages)
 *   POST   /messages/threads               (create thread + first message)
 *   POST   /messages/threads/:id/messages  (reply)
 *   PATCH  /messages/threads/:id/read      (mark all read for me)
 *
 * IMPORTANT: the backend returns raw thread/message documents (customerId is a
 * populated User object, `lastMessagePreview`, `status: open|closed`, `_id`,
 * and the detail route nests `{ thread, messages: { data } }`). The UI, however,
 * consumes a flat view-model (`customer` name string, `preview`, `status`,
 * `id`, `messages[]`). We adapt backend → UI here in `transformResponse` so the
 * components never touch a field that doesn't exist (the crash behind
 * "Cannot read properties of undefined (reading 'split')").
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

// --- raw backend shapes (what the API actually sends) -----------------------

interface RawUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
}
interface RawOrder {
  orderNumber?: string;
  status?: string;
}
interface RawThread {
  _id?: string;
  customerId?: RawUser | string;
  sellerId?: RawUser | string;
  subject?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCountSeller?: number;
  unreadCountCustomer?: number;
  relatedOrderId?: RawOrder | string;
  status?: string;
}
interface RawMessage {
  _id?: string;
  authorRole?: string;
  body?: string;
  createdAt?: string;
}
interface PaginatedThreads {
  data: RawThread[];
  meta?: Record<string, unknown>;
}
interface RawThreadDetail {
  thread?: RawThread;
  messages?: RawMessage[] | { data?: RawMessage[] };
}

// --- mappers: backend doc → UI view-model -----------------------------------

const personName = (u: RawThread['customerId']): string => {
  if (u && typeof u === 'object') {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return name || u.email || 'Customer';
  }
  return 'Customer';
};
const emailOf = (u: RawThread['customerId']): string =>
  u && typeof u === 'object' && u.email ? u.email : '';
const orderNo = (o: RawThread['relatedOrderId']): string | undefined =>
  o && typeof o === 'object' ? o.orderNumber : undefined;

const fmtDate = (x?: string): string => {
  if (!x) return '';
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};
const fmtDateTime = (x?: string): string => {
  if (!x) return '';
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};
const statusOf = (t: RawThread): MessageStatus =>
  (t.unreadCountSeller ?? 0) > 0 ? 'unread' : 'read';

const mapMessage = (m: RawMessage): Message => ({
  id: String(m._id ?? ''),
  from: m.authorRole === 'seller' ? 'seller' : 'customer',
  body: m.body ?? '',
  sentAt: fmtDateTime(m.createdAt),
});

const mapThread = (t: RawThread, messages: Message[] = []): MessageThread => ({
  id: String(t._id ?? ''),
  customer: personName(t.customerId),
  customerEmail: emailOf(t.customerId),
  orderId: orderNo(t.relatedOrderId),
  subject: t.subject || '(no subject)',
  preview: t.lastMessagePreview ?? '',
  status: statusOf(t),
  lastMessageAt: fmtDate(t.lastMessageAt),
  unreadCount: t.unreadCountSeller ?? 0,
  messages,
});

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
        const arr = (unwrapped?.data ?? []) as RawThread[];
        return arr.map((t) => mapThread(t));
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Message', id: 'LIST' }, ...result.map((m) => ({ type: 'Message' as const, id: m.id }))]
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
        return { url: `/messages/threads/${id}`, method: 'GET', params };
      },
      transformResponse: (res: ResponseEnvelope<RawThreadDetail> | RawThreadDetail) => {
        const u = unwrapEnvelope<RawThreadDetail>(res) ?? {};
        const t = (u.thread ?? {}) as RawThread;
        const md = u.messages;
        const rawMsgs: RawMessage[] = Array.isArray(md) ? md : md?.data ?? [];
        // Backend returns newest-first; the thread view reads oldest→newest.
        const messages = rawMsgs.map(mapMessage).reverse();
        return mapThread(t, messages);
      },
      providesTags: (_, __, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [{ type: 'Message', id }];
      },
    }),

    createThread: builder.mutation<unknown, CreateThreadBody>({
      query: (body) => ({ url: '/messages/threads', method: 'POST', body }),
      invalidatesTags: [{ type: 'Message', id: 'LIST' }],
    }),

    markRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/messages/threads/${id}/read`, method: 'PATCH' }),
      invalidatesTags: (_, __, id) => [{ type: 'Message', id }, { type: 'Message', id: 'LIST' }],
    }),

    replyToThread: builder.mutation<unknown, ReplyThreadBody>({
      query: ({ id, body, attachments }) => ({
        url: `/messages/threads/${id}/messages`,
        method: 'POST',
        body: { body, ...(attachments ? { attachments } : {}) },
      }),
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