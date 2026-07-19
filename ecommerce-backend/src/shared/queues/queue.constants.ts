import type { JobsOptions } from 'bullmq';

/** Outbox-driven queue names (one dedicated queue per side-effect handler). */
export const QUEUE_NAMES = {
  MAIL: 'events.mail',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Applied to every fanned-out job: 5 attempts, exp backoff (~5s→50m), retention. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 30 }, // keep failed jobs 30d for forensics
};

/** BullMQ v5 forbids ':' in job ids; our idempotency keys use ':'. */
export function sanitizeJobId(key: string): string {
  return key.replace(/:/g, '_');
}
