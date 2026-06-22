import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';

/**
 * Seller settings (E1).
 *
 * Backend: ecommerce-backend/src/seller-settings/seller-settings.controller.ts
 *   GET /seller/me/settings — read or create-on-first-read the current
 *     seller's settings document.
 *   PUT /seller/me/settings — full update via $set (UpdateSellerSettingsDto).
 *
 * The settings document is sectioned: storeProfile, payouts, tax,
 * notifications, shippingDefaults, plus a top-level preferredLanguage.
 * Each sub-page in app/(portal)/settings/<slug> consumes only its slice and
 * submits a partial body containing just that section.
 */

export interface StoreProfile {
  displayName?: string;
  slug?: string;
  logoUrl?: string;
  country?: string;
  /** Backend defaults to 'USD' when missing. */
  currency?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export type PayoutMethod = 'stripe' | 'bank' | 'paypal';
export type PayoutSchedule = 'weekly' | 'biweekly' | 'monthly';

export interface Payouts {
  stripeConnectAccountId?: string;
  payoutMethod?: PayoutMethod;
  bankAccountLast4?: string;
  payoutSchedule?: PayoutSchedule;
}

export interface TaxSettings {
  taxId?: string;
  taxExempt?: boolean;
  /** Stored as a fraction 0..1 on the backend (e.g. 0.18 == 18%). */
  defaultTaxRate?: number;
}

export interface NotificationPrefs {
  newOrderEmail?: boolean;
  lowStockEmail?: boolean;
  returnRequestEmail?: boolean;
  messageEmail?: boolean;
}

export interface ShippingDefaultsSettings {
  defaultZoneId?: string;
  defaultHandlingDays?: number;
}

export interface SellerSettings {
  _id?: string;
  sellerId?: string;
  storeProfile: StoreProfile;
  payouts: Payouts;
  tax: TaxSettings;
  notifications: NotificationPrefs;
  shippingDefaults: ShippingDefaultsSettings;
  preferredLanguage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateSellerSettingsPayload {
  storeProfile?: StoreProfile;
  payouts?: Payouts;
  tax?: TaxSettings;
  notifications?: NotificationPrefs;
  shippingDefaults?: ShippingDefaultsSettings;
  preferredLanguage?: string;
}

const SETTINGS_TAG = { type: 'Settings' as const, id: 'CURRENT' };

export const sellerSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<SellerSettings, void>({
      query: () => ({ url: '/seller/me/settings', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<SellerSettings> | SellerSettings) =>
        unwrapEnvelope<SellerSettings>(res),
      providesTags: [SETTINGS_TAG],
    }),

    updateSettings: builder.mutation<SellerSettings, UpdateSellerSettingsPayload>({
      query: (body) => ({
        url: '/seller/me/settings',
        method: 'PUT',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<SellerSettings> | SellerSettings) =>
        unwrapEnvelope<SellerSettings>(res),
      invalidatesTags: [SETTINGS_TAG],
    }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation } = sellerSettingsApi;
