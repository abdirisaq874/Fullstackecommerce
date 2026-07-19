import { EmailEventType } from '../shared/events/email-event.enum';

export type RecipientKind = 'user' | 'storeOwner' | 'invitee';

export interface EventTemplateSpec {
  template: string;
  brandKind: 'store' | 'platform';
  recipient: RecipientKind;
  subject: (p: Record<string, any>) => string;
}

/** Maps a domain event → the email to send (template, branding, recipient, subject). */
export const EVENT_TEMPLATE_MAP: Record<string, EventTemplateSpec> = {
  [EmailEventType.ORDER_PLACED]: {
    template: 'order-received',
    brandKind: 'platform',
    recipient: 'user',
    subject: () => 'We received your order',
  },
  [EmailEventType.ORDER_CONFIRMED]: {
    template: 'order-confirmed',
    brandKind: 'store',
    recipient: 'user',
    subject: (p) => `Order ${p.orderNumber} confirmed`,
  },
  [EmailEventType.ORDER_SHIPPED]: {
    template: 'order-shipped',
    brandKind: 'store',
    recipient: 'user',
    subject: (p) => `Your order ${p.orderNumber} has shipped`,
  },
  [EmailEventType.ORDER_DELIVERED]: {
    template: 'order-delivered',
    brandKind: 'store',
    recipient: 'user',
    subject: (p) => `Order ${p.orderNumber} delivered`,
  },
  [EmailEventType.ORDER_CANCELLED]: {
    template: 'order-cancelled',
    brandKind: 'store',
    recipient: 'user',
    subject: (p) => `Order ${p.orderNumber} was cancelled`,
  },
  [EmailEventType.STORE_ORDER_RECEIVED]: {
    template: 'store-new-order',
    brandKind: 'store',
    recipient: 'storeOwner',
    subject: (p) => `New order ${p.orderNumber}`,
  },
  [EmailEventType.RETURN_REQUESTED]: {
    template: 'return-requested',
    brandKind: 'store',
    recipient: 'user',
    subject: () => 'Return request received',
  },
  [EmailEventType.REFUND_ISSUED]: {
    template: 'refund-issued',
    brandKind: 'store',
    recipient: 'user',
    subject: () => 'Your refund has been issued',
  },
  [EmailEventType.PAYOUT_PAID]: {
    template: 'payout-paid',
    brandKind: 'store',
    recipient: 'storeOwner',
    subject: () => 'You’ve been paid',
  },
  [EmailEventType.AUTH_EMAIL_VERIFY]: {
    template: 'email-verification',
    brandKind: 'platform',
    recipient: 'user',
    subject: () => 'Verify your email',
  },
  [EmailEventType.AUTH_PASSWORD_RESET]: {
    template: 'password-reset',
    brandKind: 'platform',
    recipient: 'user',
    subject: () => 'Reset your password',
  },
  [EmailEventType.STORE_STAFF_INVITED]: {
    template: 'staff-invite',
    brandKind: 'store',
    recipient: 'invitee',
    subject: (p) => `You’re invited to join ${p.storeName || 'a store'}`,
  },
};
