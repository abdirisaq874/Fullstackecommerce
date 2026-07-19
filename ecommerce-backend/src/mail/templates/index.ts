/**
 * Barrel — importing this registers every email template into EMAIL_TEMPLATES.
 * MailModule imports it for the side effect. Add new templates here.
 */
import { registerTemplates } from './registry';

import OrderReceived from './order-received';
import OrderConfirmed from './order-confirmed';
import OrderShipped from './order-shipped';
import OrderDelivered from './order-delivered';
import OrderCancelled from './order-cancelled';
import StoreNewOrder from './store-new-order';
import ReturnRequested from './return-requested';
import RefundIssued from './refund-issued';
import PayoutPaid from './payout-paid';
import EmailVerification from './email-verification';
import PasswordReset from './password-reset';
import StaffInvite from './staff-invite';

registerTemplates({
  'order-received': OrderReceived,
  'order-confirmed': OrderConfirmed,
  'order-shipped': OrderShipped,
  'order-delivered': OrderDelivered,
  'order-cancelled': OrderCancelled,
  'store-new-order': StoreNewOrder,
  'return-requested': ReturnRequested,
  'refund-issued': RefundIssued,
  'payout-paid': PayoutPaid,
  'email-verification': EmailVerification,
  'password-reset': PasswordReset,
  'staff-invite': StaffInvite,
});

export {};
