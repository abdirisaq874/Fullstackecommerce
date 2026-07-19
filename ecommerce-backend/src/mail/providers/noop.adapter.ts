import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EmailProviderAdapter, SendEmailParams, SendResult } from './email-provider.interface';

/**
 * Dev/test transport — logs and records instead of sending. Auto-selected when
 * RESEND_API_KEY is missing/placeholder or EMAIL_PROVIDER=noop.
 */
@Injectable()
export class NoopEmailAdapter extends EmailProviderAdapter {
  readonly name = 'noop';
  private readonly logger = new Logger(NoopEmailAdapter.name);
  readonly sent: SendEmailParams[] = [];

  async send(params: SendEmailParams): Promise<SendResult> {
    this.sent.push(params);
    this.logger.debug(`[noop] would send "${params.subject}" → ${params.to}`);
    return { providerMessageId: `noop-${randomUUID()}` };
  }
}
