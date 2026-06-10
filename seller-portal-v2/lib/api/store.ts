import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { baseApi } from './base-api';
import { rtkQueryErrorMiddleware } from './error-middleware';
import uiReducer from './ui-slice';
import authReducer from '@/lib/store/auth-slice';

// Ensure all slices register their endpoints by importing them at app boot
import './products-api';
import './orders-api';
import './inventory-api';
import './returns-api';
import './messages-api';
import './dashboard-api';
import './notifications-api';
import './seller-settings-api';
import './finance-api';
import './coupons-api';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    ui: uiReducer,
    auth: authReducer,
  },
  middleware: (gDM) => gDM().concat(baseApi.middleware).concat(rtkQueryErrorMiddleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
