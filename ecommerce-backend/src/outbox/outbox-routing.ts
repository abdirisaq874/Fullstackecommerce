import { QUEUE_NAMES, QueueName } from '../shared/queues/queue.constants';
import { EmailEventType } from '../shared/events/email-event.enum';

/**
 * Which queue(s) each domain-event type fans out to. Currently only the mail
 * queue is outbox-driven; add entries here as new side-effect handlers arrive.
 */
export const HANDLER_ROUTING: Record<QueueName, Set<string>> = {
  [QUEUE_NAMES.MAIL]: new Set<string>(Object.values(EmailEventType)),
};

export function targetQueuesFor(eventType: string): QueueName[] {
  return (Object.keys(HANDLER_ROUTING) as QueueName[]).filter((q) =>
    HANDLER_ROUTING[q].has(eventType),
  );
}
