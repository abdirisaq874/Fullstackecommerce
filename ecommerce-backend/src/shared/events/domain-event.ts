/**
 * Lightweight domain-event contract for the transactional outbox. A publisher
 * describes an event; the outbox persists it (atomically with the state change
 * when a Mongo session is supplied) and the poller fans it out to BullMQ.
 */
export interface DomainEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
  /**
   * Override the default `${eventType}:${aggregateId}` dedup key. Needed for
   * fan-out to multiple recipients of the SAME aggregate (append `:${userId}`)
   * so the outbox unique index doesn't collapse them into one.
   */
  idempotencyKey?: string;
}

/** The wire shape carried on the BullMQ job (IDs + minimal context; consumers re-fetch). */
export interface EventJobData {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string; // ISO
  correlationId?: string;
  outboxEventId: string;
  idempotencyKey: string;
}

export function defaultIdempotencyKey(e: DomainEventInput): string {
  return e.idempotencyKey ?? `${e.eventType}:${e.aggregateId}`;
}
