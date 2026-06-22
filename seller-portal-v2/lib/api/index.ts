export * from './base-api';
export * from './store';
export * from './ui-slice';
export * from './products-api';
export * from './orders-api';
export * from './inventory-api';
export * from './returns-api';
export * from './messages-api';
export * from './dashboard-api';
export * from './customers-api';

// notifications-api.ts re-exports use a selective form because the legacy
// `notificationsApi` slice and hook names also live in `dashboard-api.ts`
// for backward compatibility. We expose only the new C7 hook surface here
// to avoid `export *` ambiguity. Existing consumers continue importing the
// legacy hooks from dashboard-api.ts via `export *` above.
export {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  notificationsApi as notificationsApiV2,
  type ListNotificationsParams,
} from './notifications-api';

export * from './seller-settings-api';
export * from './finance-api';
export * from './shipping-api';
export * from './coupons-api';
export * from './uploads-api';
export * from './upload-helpers';
export * from './search-api';
