'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store, useAppDispatch } from '@/store';
import { hydrate } from '@/store/slices/authSlice';
import { hydrateWishlist } from '@/store/slices/wishlistSlice';
import { authApi } from '@/store/api/authApi';

function Bootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(hydrate());
    dispatch(hydrateWishlist());
    if (store.getState().auth.accessToken) {
      dispatch(authApi.endpoints.me.initiate());
    }
  }, [dispatch]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Bootstrap />
      {children}
      <Toaster position="top-center" richColors closeButton />
    </Provider>
  );
}
