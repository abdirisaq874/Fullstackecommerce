export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailParams {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  tags?: { name: string; value: string }[];
  /** Provider-side idempotency (Resend `Idempotency-Key`). */
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  providerMessageId: string;
}

/** Pluggable transport. Swap Resend ↔ Noop ↔ (future) SMTP without touching MailService. */
export abstract class EmailProviderAdapter {
  abstract readonly name: string;
  abstract send(params: SendEmailParams): Promise<SendResult>;
}

/** Do NOT retry — a bad address / invalid key won't succeed on retry. */
export class PermanentEmailError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

/** Retryable — rate limit / network / 5xx. */
export class TransientEmailError extends Error {
  readonly permanent = false;
  constructor(message: string) {
    super(message);
    this.name = 'TransientEmailError';
  }
}
