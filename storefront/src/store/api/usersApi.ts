import { apiSlice } from './apiSlice';
import type { Address, User } from '@/types';

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    updateProfile: builder.mutation<User, Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'avatarUrl'>>>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
    listAddresses: builder.query<Address[], void>({
      query: () => '/users/me/addresses',
      providesTags: ['Address'],
    }),
    addAddress: builder.mutation<Address, Address>({
      query: (body) => ({ url: '/users/me/addresses', method: 'POST', body }),
      invalidatesTags: ['Address'],
    }),
    updateAddress: builder.mutation<Address, { id: string; data: Partial<Address> }>({
      query: ({ id, data }) => ({ url: `/users/me/addresses/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Address'],
    }),
    deleteAddress: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/me/addresses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Address'],
    }),
    // Backend addition (change password while logged in)
    changePassword: builder.mutation<{ message: string }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/users/me/password', method: 'PATCH', body }),
    }),
  }),
});

export const {
  useUpdateProfileMutation,
  useListAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useChangePasswordMutation,
} = usersApi;
