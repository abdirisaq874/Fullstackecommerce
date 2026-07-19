/**
 * Domain event types that fan out to the mail queue. The string values are the
 * BullMQ job names and the outbox `eventType`; keep them stable (they appear in
 * `email_logs.triggeredByEventType` and drive idempotency).
 */
export enum EmailEventType {
  ORDER_PLACED = 'order.placed', // buyer: consolidated per checkout
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_CANCELLED = 'order.cancelled',
  STORE_ORDER_RECEIVED = 'store.order.received', // seller alert (per store-order)
  RETURN_REQUESTED = 'return.requested',
  REFUND_ISSUED = 'refund.issued',
  PAYOUT_PAID = 'payout.paid',
  AUTH_EMAIL_VERIFY = 'auth.email.verify',
  AUTH_PASSWORD_RESET = 'auth.password.reset',
  STORE_STAFF_INVITED = 'store.staff.invited',
}
