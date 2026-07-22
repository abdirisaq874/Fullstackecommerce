'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { Toaster, toast } from 'sonner';
import { store, useAppDispatch, useAppSelector } from '@/store';
import { hydrate, logout } from '@/store/slices/authSlice';
import { hydrateWishlist } from '@/store/slices/wishlistSlice';
import { authApi } from '@/store/api/authApi';
import { OpenReplay } from '@/components/OpenReplay';

function Bootstrap() {
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.user?.role);

  useEffect(() => {
    dispatch(hydrate());
    dispatch(hydrateWishlist());
    if (store.getState().auth.accessToken) {
      dispatch(authApi.endpoints.me.initiate());
    }
  }, [dispatch]);

  // The storefront is customer-only. Seller accounts must not hold a shopping
  // session here (they use the seller portal); if one is detected — on login or
  // from a restored session — sign it out and explain why.
  useEffect(() => {
    if (role === 'seller') {
      dispatch(logout());
      toast.error(
        "Seller accounts can't shop here. Please sign in with a customer account to purchase.",
      );
    }
  }, [role, dispatch]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Bootstrap />
      <OpenReplay />
      {children}
      <Toaster position="top-center" richColors closeButton />
    </Provider>
  );
}
