/**
 * Stores RTK Query slice — a seller's stores + staff/membership.
 *   listMyStores  → GET    /stores/mine
 *   createStore   → POST   /stores
 *   updateStore   → PATCH  /stores/:id
 *   archiveStore  → DELETE /stores/:id
 *   members       → GET/POST/PATCH/DELETE /stores/:id/members[/:userId]
 * The active store the user is acting as travels as the X-Store-Id header
 * (injected in base-api prepareHeaders from localStorage) — NOT via these calls.
 */
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';

export type StoreRole = 'owner' | 'manager' | 'staff';

export interface Store {
  _id: string;
  ownerId: string;
  displayName: string;
  slug: string;
  logoUrl?: string;
  country?: string;
  currency: string;
  status: 'active' | 'archived';
  /** the signed-in user's role in this store (present on listMyStores) */
  myRole?: StoreRole;
}

export interface StoreMember {
  userId: string;
  role: StoreRole;
  status: 'active' | 'invited' | 'revoked';
  email?: string;
  name?: string;
}

export interface CreateStoreBody {
  displayName: string;
  slug?: string;
  logoUrl?: string;
  country?: string;
  currency?: string;
}

export const storesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMyStores: builder.query<Store[], void>({
      query: () => ({ url: '/stores/mine', method: 'GET' }),
      transformResponse: (r: ResponseEnvelope<Store[]> | Store[]) => unwrapEnvelope<Store[]>(r) ?? [],
      providesTags: [{ type: 'Store', id: 'LIST' }],
    }),
    createStore: builder.mutation<Store, CreateStoreBody>({
      query: (body) => ({ url: '/stores', method: 'POST', body }),
      transformResponse: (r: ResponseEnvelope<Store> | Store) => unwrapEnvelope<Store>(r),
      invalidatesTags: [{ type: 'Store', id: 'LIST' }],
    }),
    updateStore: builder.mutation<Store, { id: string; patch: Partial<CreateStoreBody> & { supportEmail?: string; supportPhone?: string } }>({
      query: ({ id, patch }) => ({ url: `/stores/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (r: ResponseEnvelope<Store> | Store) => unwrapEnvelope<Store>(r),
      invalidatesTags: [{ type: 'Store', id: 'LIST' }],
    }),
    archiveStore: builder.mutation<{ archived: true }, string>({
      query: (id) => ({ url: `/stores/${id}`, method: 'DELETE' }),
      transformResponse: (r: ResponseEnvelope<{ archived: true }> | { archived: true }) => unwrapEnvelope(r),
      invalidatesTags: [{ type: 'Store', id: 'LIST' }],
    }),

    listStoreMembers: builder.query<StoreMember[], string>({
      query: (storeId) => ({ url: `/stores/${storeId}/members`, method: 'GET' }),
      transformResponse: (r: ResponseEnvelope<StoreMember[]> | StoreMember[]) => unwrapEnvelope<StoreMember[]>(r) ?? [],
      providesTags: (_r, _e, storeId) => [{ type: 'StoreMember', id: storeId }],
    }),
    addStoreMember: builder.mutation<{ userId: string; role: StoreRole }, { storeId: string; email: string; role: StoreRole }>({
      query: ({ storeId, email, role }) => ({ url: `/stores/${storeId}/members`, method: 'POST', body: { email, role } }),
      transformResponse: (r: ResponseEnvelope<any> | any) => unwrapEnvelope(r),
      invalidatesTags: (_r, _e, { storeId }) => [{ type: 'StoreMember', id: storeId }],
    }),
    updateStoreMember: builder.mutation<void, { storeId: string; userId: string; role: StoreRole }>({
      query: ({ storeId, userId, role }) => ({ url: `/stores/${storeId}/members/${userId}`, method: 'PATCH', body: { role } }),
      invalidatesTags: (_r, _e, { storeId }) => [{ type: 'StoreMember', id: storeId }],
    }),
    removeStoreMember: builder.mutation<void, { storeId: string; userId: string }>({
      query: ({ storeId, userId }) => ({ url: `/stores/${storeId}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { storeId }) => [{ type: 'StoreMember', id: storeId }],
    }),
  }),
});

export const {
  useListMyStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useArchiveStoreMutation,
  useListStoreMembersQuery,
  useAddStoreMemberMutation,
  useUpdateStoreMemberMutation,
  useRemoveStoreMemberMutation,
} = storesApi;
